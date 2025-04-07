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

  useEffect(() => {
    // Initialize socket connection
    socket.current = io('http://localhost:5000');

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
      (result, status) => {
        if (status === 'OK') {
          setDirections(result);
          const route = result.routes[0].legs[0];
          setDistance(route.distance.value / 1000); // Convert to kilometers
          setDuration(route.duration.value / 60); // Convert to minutes
          const fare = calculateFare(route.distance.value / 1000);
          setFare(fare);
        }
      }
    );
  };

  const calculateFare = (distance) => {
    const baseFare = 2.5;
    const perKmRate = 1.5;
    return baseFare + (distance * perKmRate);
  };

  const handleBookRide = async () => {
    try {
      setRideStatus('requesting');
      const response = await axios.post('http://localhost:5000/api/rides/book', {
        pickup: pickup,
        dropoff: dropoff,
        pickup_lat: center.lat,
        pickup_lng: center.lng,
        dropoff_lat: selectedLocation.lat,
        dropoff_lng: selectedLocation.lng,
        fare: fare,
        distance: distance,
        duration: duration
      });
      
      setRideId(response.data.ride_id);
      socket.current.emit('ride_requested', {
        rideId: response.data.ride_id,
        pickup: pickup,
        dropoff: dropoff,
        fare: fare
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
    if (!distance || !duration || !fare) return null;

    return (
      <Card sx={{ mb: 2, bgcolor: 'background.paper' }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <Typography variant="subtitle2" color="textSecondary">Distance</Typography>
              <Typography variant="h6">{distance.toFixed(1)} km</Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="subtitle2" color="textSecondary">Duration</Typography>
              <Typography variant="h6">{Math.round(duration)} min</Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="subtitle2" color="textSecondary">Estimated Fare</Typography>
              <Typography variant="h6" color="primary">${fare.toFixed(2)}</Typography>
            </Grid>
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
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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