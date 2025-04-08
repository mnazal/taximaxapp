import { useState, useRef, useEffect } from 'react';
import { GoogleMap, LoadScript, Autocomplete, DirectionsRenderer } from '@react-google-maps/api';
import { Box, Button, TextField, Paper, Typography, CircularProgress, Alert, Card, CardContent, Grid } from '@mui/material';
import axios from 'axios';
import { io } from 'socket.io-client';

const containerStyle = {
  width: '100%',
  height: '500px'
};

// Default to Thiruvananthapuram coordinates
const defaultCenter = {
  lat: 8.5241,
  lng: 76.9366
};

const libraries = ['places', 'directions'];

function RiderPage() {
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [fare, setFare] = useState(null);
  const [rideId, setRideId] = useState(null);
  const [center, setCenter] = useState(defaultCenter);
  const [directions, setDirections] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [distance, setDistance] = useState(null);
  const [duration, setDuration] = useState(null);
  const [rideStatus, setRideStatus] = useState('idle'); // idle, requesting, confirmed
  const [driverDetails, setDriverDetails] = useState(null);
  const pickupRef = useRef(null);
  const dropoffRef = useRef(null);
  const mapRef = useRef(null);
  const socket = useRef(null);
  const [isCalculatingFare, setIsCalculatingFare] = useState(false);
  const [fareError, setFareError] = useState(null);
  const [trafficLevel, setTrafficLevel] = useState(1);
  const [trafficBlocks, setTrafficBlocks] = useState(3);
  const [weatherSeverity, setWeatherSeverity] = useState(2);
  const [isHoliday, setIsHoliday] = useState(false);
  const [isEventNearby, setIsEventNearby] = useState(false);


  useEffect(() => {
    // Initialize socket connection
    socket.current = io(import.meta.env.VITE_SOCKET_URL);

    // Socket event listeners
    socket.current.on('ride_assigned', (data) => {
      setRideStatus('confirmed');
      setDriverDetails(data.driver);
    });

    // Get user's current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setCenter(userLocation);
          setPickup('Current Location');
        },
        (error) => {
          console.error('Error getting location:', error);
          setCenter(defaultCenter);
        }
      );
    } else {
      console.error('Geolocation is not supported by this browser.');
      setCenter(defaultCenter);
    }

    return () => {
      if (socket.current) {
        socket.current.disconnect();
      }
    };
  }, []);

  const handleMapClick = (event) => {
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    setSelectedLocation({ lat, lng });
    
    // Reverse geocode to get address
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results[0]) {
        setDropoff(results[0].formatted_address);
        calculateRoute(lat, lng);
      }
    });
  };

  const calculateRoute = (destLat, destLng) => {
    if (!center.lat || !center.lng) return;

    const directionsService = new window.google.maps.DirectionsService();
    directionsService.route(
      {
        origin: { lat: center.lat, lng: center.lng },
        destination: { lat: destLat, lng: destLng },
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      async (result, status) => {
        if (status === 'OK') {
          setDirections(result);
          const route = result.routes[0].legs[0];
          const newDistance = route.distance.value / 1000; // Convert to kilometers
          const newDuration = route.duration.value / 60; // Convert to minutes
          setDistance(newDistance);
          setDuration(newDuration);

          const trafficResponse = await getRouteWithTraffic(destLat, destLng, center.lat, center.lng);
          
          // Calculate fare after getting route details
          await calculateFare(newDistance, newDuration, trafficResponse);
        }
      }
    );
  };

  const getRouteWithTraffic = async (destLat, destLng, pickupLat, pickupLng) => {
    try {
      // Check if we have valid coordinates
      if (!pickupLat || !pickupLng || !destLat || !destLng) {
        console.warn('Missing coordinates for traffic calculation');
        return {
          distanceInKm: 0,
          durationInTrafficMin: 0
        };
      }

      return new Promise((resolve, reject) => {
        const directionsService = new window.google.maps.DirectionsService();
        
        directionsService.route(
          {
            origin: new window.google.maps.LatLng(pickupLat, pickupLng),
            destination: new window.google.maps.LatLng(destLat, destLng),
            travelMode: window.google.maps.TravelMode.DRIVING,
            drivingOptions: {
              departureTime: new Date(),
              trafficModel: window.google.maps.TrafficModel.BEST_GUESS
            }
          },
          (result, status) => {
            if (status === window.google.maps.DirectionsStatus.OK) {
              const route = result.routes[0];
              const leg = route.legs[0];
              
              const distanceInKm = leg.distance.value / 1000;
              const durationInTrafficMin = leg.duration_in_traffic?.value / 60 || leg.duration.value / 60;
              
              resolve({ distanceInKm, durationInTrafficMin });
            } else {
              console.warn('Error getting directions:', status);
              resolve({
                distanceInKm: 0,
                durationInTrafficMin: 0
              });
            }
          }
        );
      });
    } catch (error) {
      console.error('Error getting traffic data:', error);
      return {
        distanceInKm: 0,
        durationInTrafficMin: 0
      };
    }
  };
  
  const calculateFare = async (routeDistance, routeDuration, trafficResponse) => {
    try {
      setIsCalculatingFare(true);
      setFareError(null);
      
      // Get weather severity for the pickup location
      const weatherSeverity = await getWeatherSeverity(center.lat, center.lng);

      const trafficFactor = trafficResponse.durationInTrafficMin / routeDuration;

      let trafficLevel = 0;
      let trafficBlocks = 0;

      console.log("Traffic factor:", trafficFactor);
    
      if (trafficFactor >= 1.4) {
        trafficLevel = 3;
        trafficBlocks = 1;
      } else if (trafficFactor >= 1.2) {
        trafficLevel = 2;
        trafficBlocks = 2;
      } else {
        trafficLevel = 1;
        trafficBlocks = 3;
      }
      setTrafficLevel(trafficLevel);
      setTrafficBlocks(trafficBlocks);
      setWeatherSeverity(weatherSeverity);
      // Use API in future
      setIsHoliday(false);
      setIsEventNearby(false);
      
      // Create request payload with actual route details
      const requestPayload = {
        trip_request: {
          user_id: "user123",
          distance: routeDistance || 5,
          duration: routeDuration || 15,
          ride_demand_level: 4,
          traffic_level: trafficLevel || 1,
          weather_severity: weatherSeverity,
          traffic_blocks: trafficBlocks || 3,
          is_holiday: false,
          is_event_nearby: false
        },
        user_profile: {
          loyalty_tier: 4,
          price_sensitivity: 0.95
        },
        current_supply: 15
      };

      const response = await axios.post(import.meta.env.VITE_RIDE_PRICING_API_URL, requestPayload, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (response.data && response.data.fare) {
        setFare(response.data.fare);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Error calculating fare:', error);
      setFareError('Failed to calculate fare. Please try again.');
    } finally {
      setIsCalculatingFare(false);
    }
  };

  const getWeatherSeverity = async (lat, lng) => {
    const apiKey = import.meta.env.VITE_WEATHER_API_KEY;
    const weatherApiUrl = import.meta.env.VITE_WEATHER_API_URL;
    const response = await axios.get(
      `${weatherApiUrl}/weather?lat=${lat}&lon=${lng}&units=metric&appid=${apiKey}`
    );
    
    const weather = response.data.weather[0].main;
    // Convert weather condition to severity level (1-5)
    const severityMap = {
      'Clear': 1,
      'Clouds': 2,
      'Rain': 3,
      'Snow': 4,
      'Thunderstorm': 5
    };
    
    return severityMap[weather] || 2; // Default to 2 if weather not found
  };

  const handleBookRide = async () => {
    try {
      setRideStatus('requesting');
      
      // Get weather severity
      // const weatherSeverity = await getWeatherSeverity(center.lat, center.lng);
      
      // // Create the request payload
      // const requestPayload = {
      //   trip_request: {
      //     user_id: "user123", // You should replace this with actual user ID
      //     distance: distance,
      //     duration: duration,
      //     ride_demand_level: 4, // You might want to calculate this based on time of day
      //     traffic_level: 3, // You might want to get this from a traffic API
      //     weather_severity: weatherSeverity,
      //     traffic_blocks: 3, // You might want to calculate this based on route
      //     is_holiday: false, // You might want to check against a holiday calendar
      //     is_event_nearby: false // You might want to check against an events API
      //   },
      //   user_profile: {
      //     loyalty_tier: 4, // You should get this from user data
      //     price_sensitivity: 0.95 // You should get this from user data
      //   },
      //   current_supply: 15 // You should get this from your backend
      // };

      // // Calculate fare first
      // const fareResponse = await axios.post(import.meta.env.VITE_RIDE_PRICING_API_URL, requestPayload);
      // const calculatedFare = fareResponse.data.fare;
      // setFare(calculatedFare);
      
      // Send the booking request to your backend
      const bookingResponse = await axios.post(`${import.meta.env.VITE_SOCKET_URL}/api/rides/book`, {
        pickup: pickup,
        dropoff: dropoff,
        pickup_lat: center.lat,
        pickup_lng: center.lng,
        dropoff_lat: selectedLocation.lat,
        dropoff_lng: selectedLocation.lng,
        fare: fare,
        distance: distance,
        duration: duration,
        ride_demand_level: 4,
        traffic_level: trafficLevel,
        weather_severity: weatherSeverity,
        traffic_blocks: trafficBlocks,
        is_holiday: isHoliday,
        is_event_nearby: isEventNearby,
        user_loyalty_tier: 2
      });
      
      // Store the ride ID and emit the socket event with the same data
      setRideId(bookingResponse.data.ride_id);
      socket.current.emit('ride_requested', {
        rideId: bookingResponse.data.ride_id,
        pickup: pickup,
        dropoff: dropoff,
        fare: fare,
        pickup_lat: center.lat,
        pickup_lng: center.lng,
        dropoff_lat: selectedLocation.lat,
        dropoff_lng: selectedLocation.lng,
        ride_demand_level: 4,
        traffic_level: trafficLevel,
        weather_severity: weatherSeverity,
        traffic_blocks: trafficBlocks,
        is_holiday: isHoliday,
        is_event_nearby: isEventNearby,
        user_loyalty_tier: 2
      });
    } catch (error) {
      console.error('Error booking ride:', error);
      setRideStatus('idle');
    }
  };

  const onLoad = (autocomplete, type) => {
    if (type === 'pickup') {
      pickupRef.current = autocomplete;
    } else {
      dropoffRef.current = autocomplete;
    }
  };

  const onPlaceChanged = (type) => {
    const autocomplete = type === 'pickup' ? pickupRef.current : dropoffRef.current;
    if (autocomplete) {
      const place = autocomplete.getPlace();
      if (place.geometry) {
        const location = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        };
        if (type === 'pickup') {
          setPickup(place.formatted_address);
          setCenter(location);
        } else {
          setDropoff(place.formatted_address);
          setSelectedLocation(location);
          calculateRoute(location.lat, location.lng);
        }
      }
    }
  };

  const renderRideDetails = () => {
    if (!pickup) return null;

    return (
      <Card sx={{ mb: 2, bgcolor: 'background.paper' }}>
        <CardContent>
          <Grid container spacing={2}>
            {isCalculatingFare ? (
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CircularProgress size={24} sx={{ mr: 2 }} />
                  <Typography>Calculating fare...</Typography>
                </Box>
              </Grid>
            ) : fareError ? (
              <Grid item xs={12}>
                <Alert severity="error">{fareError}</Alert>
              </Grid>
            ) : (
              <>
                {distance && (
                  <Grid item xs={4}>
                    <Typography variant="subtitle2" color="textSecondary">Distance</Typography>
                    <Typography variant="h6">{distance.toFixed(1)} km</Typography>
                  </Grid>
                )}
                {duration && (
                  <Grid item xs={4}>
                    <Typography variant="subtitle2" color="textSecondary">Duration</Typography>
                    <Typography variant="h6">{Math.round(duration)} min</Typography>
                  </Grid>
                )}
                {fare && (
                  <Grid item xs={4}>
                    <Typography variant="subtitle2" color="textSecondary">Estimated Fare</Typography>
                    <Typography variant="h6" color="primary">Rs.{(fare).toFixed(1)}</Typography>
                  </Grid>
                )}
              </>
            )}
          </Grid>
        </CardContent>
      </Card>
    );
  };

  const renderRideStatus = () => {
    switch (rideStatus) {
      case 'requesting':
        return (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <CircularProgress size={20} sx={{ mr: 2 }} />
              <Typography>Finding a driver...</Typography>
            </Box>
          </Alert>
        );
      case 'confirmed':
        return (
          <Alert severity="success" sx={{ mt: 2 }}>
            <Typography variant="h6">Ride Confirmed!</Typography>
            <Typography>Driver: {driverDetails?.name}</Typography>
            <Typography>Vehicle: {driverDetails?.vehicle}</Typography>
            <Typography>Contact: {driverDetails?.phone}</Typography>
          </Alert>
        );
      default:
        return null;
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1000, margin: '0 auto' }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 4, fontWeight: 'bold' }}>
        Book a Ride
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper elevation={3} sx={{ p: 2, mb: 3, borderRadius: 2 }}>
            <LoadScript
              googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
              libraries={libraries}
            >
              <GoogleMap
                mapContainerStyle={containerStyle}
                center={center}
                zoom={15}
                onClick={handleMapClick}
                onLoad={(map) => (mapRef.current = map)}
                options={{
                  styles: [
                    {
                      featureType: "poi",
                      elementType: "labels",
                      stylers: [{ visibility: "off" }]
                    }
                  ]
                }}
              >
                {directions && <DirectionsRenderer directions={directions} />}
              </GoogleMap>
            </LoadScript>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper elevation={3} sx={{ p: 3, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, }}>
              <LoadScript
                googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
                libraries={libraries}
              >
                <Autocomplete
                  onLoad={(autocomplete) => onLoad(autocomplete, 'pickup')}
                  onPlaceChanged={() => onPlaceChanged('pickup')}
                >
                  <TextField
                    fullWidth
                    label="Pickup Location"
                    value={pickup}
                    onChange={(e) => setPickup(e.target.value)}
                    variant="outlined"
                  />
                </Autocomplete>
                
                <Autocomplete
                  onLoad={(autocomplete) => onLoad(autocomplete, 'dropoff')}
                  onPlaceChanged={() => onPlaceChanged('dropoff')}
                >
                  <TextField
                    fullWidth
                    label="Dropoff Location"
                    value={dropoff}
                    onChange={(e) => setDropoff(e.target.value)}
                    variant="outlined"
                  />
                </Autocomplete>
              </LoadScript>

              <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center' }}>
                Click on the map to select your destination
              </Typography>

              {renderRideDetails()}

              <Button
                variant="contained"
                onClick={handleBookRide}
                disabled={!pickup || !dropoff || rideStatus === 'requesting'}
                size="large"
                sx={{ 
                  py: 1.5,
                  bgcolor: 'primary.main',
                  '&:hover': { bgcolor: 'primary.dark' }
                }}
              >
                {rideStatus === 'requesting' ? 'Requesting Ride...' : 'Book Ride'}
              </Button>

              {renderRideStatus()}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default RiderPage; 