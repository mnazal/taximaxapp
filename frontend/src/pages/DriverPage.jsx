  import { useState, useEffect, useRef, useCallback } from 'react';
  import { GoogleMap, LoadScript, DirectionsRenderer, Marker } from '@react-google-maps/api';
  import { Box, Button, Paper, Typography, Card, CardContent, Grid, List, CircularProgress, Alert, useMediaQuery, useTheme } from '@mui/material';
  import { io } from 'socket.io-client';
  import axios from 'axios';
  import Header from '../components/Header';

  const containerStyle = {
    width: '100%',
    height: '400px'
  };

  const defaultCenter = {
    lat: 8.5241,
    lng: 76.9366
  };

  const libraries = ['places', 'directions'];

  function DriverPage() {
    const [center, setCenter] = useState(defaultCenter);
    const [directions, setDirections] = useState(null);
    const [rideRequests, setRideRequests] = useState([]);
    const [recommendedRideRequests, setRecommendedRideRequests] = useState([]);
    const [currentRide, setCurrentRide] = useState(null);
    const [driverStatus, setDriverStatus] = useState('available');
    const [isLoading, setIsLoading] = useState(true);
    const [isMapLoaded, setIsMapLoaded] = useState(false);
    const [recommendedRideId, setRecommendedRideId] = useState(null);
    const mapRef = useRef(null);
    const socket = useRef(null);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    // Function to get recommended ride
    const getRecommendedRide = useCallback(async (requests) => {
      if (!requests || requests.length === 0) return;

      // Calculate optimization score for each ride
      const optimizedRides = requests.map(ride => {
        // Calculate deadhead distance (distance from driver to pickup)
        const deadheadDistance = calculateDistance(
          center.lat,
          center.lng,
          ride.pickup_lat,
          ride.pickup_lng
        );

        // Calculate return trip distance (if needed)
        const returnTripDistance = calculateDistance(
          ride.dropoff_lat,
          ride.dropoff_lng,
          center.lat,
          center.lng
        );

        // Calculate total miles (paid + deadhead + return)
        const totalMiles = ride.distance + deadheadDistance + returnTripDistance;

        // Calculate total cost
        const costPerMile = 0.32;
        const totalCost = totalMiles * costPerMile;

        // Calculate profit
        const profit = ride.fare - totalCost;

        // Calculate profit per mile
        const profitPerMile = profit / totalMiles;

        // Calculate profit per minute
        const profitPerMinute = profit / ride.duration;

        // Calculate optimization score
        // Weights can be adjusted based on priority
        const score = (
          (profit * 0.4) +           // Profit weight
          (profitPerMile * 0.3) +    // Efficiency weight
          (profitPerMinute * 0.3)    // Time efficiency weight
        );

        return {
          ...ride,
          score,
          deadheadDistance,
          returnTripDistance,
          totalMiles,
          totalCost,
          profit,
          profitPerMile,
          profitPerMinute
        };
      });

      // Sort rides by optimization score
      optimizedRides.sort((a, b) => b.score - a.score);

      // Get the best ride
      const bestRide = optimizedRides[0];
      setRecommendedRideId(bestRide.rideId);

      // Log optimization details for debugging
      console.log('Optimized Rides:', optimizedRides);
      console.log('Best Ride:', bestRide);
    }, [center]);

    // Helper function to calculate distance between two points
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371; // Radius of the earth in km
      const dLat = deg2rad(lat2 - lat1);
      const dLon = deg2rad(lon2 - lon1);
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2); 
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
      const distance = R * c; // Distance in km
      return distance * 0.621371; // Convert to miles
    };

    const deg2rad = (deg) => {
      return deg * (Math.PI/180);
    };

    useEffect(() => {
      // Initialize socket connection
      socket.current = io('http://localhost:5000');

      // Socket event listeners
      socket.current.on('ride_requested', (ride) => {
        setRideRequests(prev => {
          const newRequests = [...prev, ride];
          // Get recommendation when new ride comes in
          //getRecommendedRide(newRequests);
          return newRequests;
        });
        setRecommendedRideRequests(prevRecommended => {
          console.log("Ride distance")
          console.log(ride)
          const apiRide = {
            // Add your API-specific ride format here
            user_id:"Userid",
            rideId: ride.rideId,
            distance: ride.distance,
            duration: ride.duration,
            zone: "downtown",
            timestamp: Math.floor(Date.now() /1000),
            ride_demand_level: ride.ride_demand_level,
            traffic_level: ride.traffic_level,
            weather_severity: ride.weather_severity,
            traffic_blocks: ride.traffic_blocks,
            is_holiday: ride.is_holiday,
            is_event_nearby: ride.is_event_nearby,
            fare: ride.fare,
            // Add any other fields required by your API
          };
          const newRecommendedRequests = [...prevRecommended, apiRide];
          // Get recommendation when new ride comes in
          getRecommendedRide(newRecommendedRequests);
          return newRecommendedRequests;
        });
      });

      socket.current.on('ride_cancelled', (rideId) => {
        setRideRequests(prev => {
          const newRequests = prev.filter(r => r.rideId !== rideId);
          // Update recommendation when ride is cancelled
          if (newRequests.length > 0) {
            getRecommendedRide(newRequests);
          } else {
            setRecommendedRideId(null);
          }
          return newRequests;
        });
      });

      // Get driver's current location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const location = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            setCenter(location);
            setIsLoading(false);
          },
          (error) => {
            console.error('Error getting location:', error);
            setCenter(defaultCenter);
            setIsLoading(false);
          }
        );
      } else {
        console.error('Geolocation is not supported by this browser.');
        setCenter(defaultCenter);
        setIsLoading(false);
      }

      return () => {
        if (socket.current) {
          socket.current.disconnect();
        }
      };
    }, [getRecommendedRide]);

    const calculateRoute = useCallback((pickupLat, pickupLng, dropoffLat, dropoffLng) => {
      if (!window.google || !window.google.maps) {
        console.error('Google Maps API not loaded');
        return;
      }

      const directionsService = new window.google.maps.DirectionsService();
      directionsService.route(
        {
          origin: { lat: pickupLat, lng: pickupLng },
          destination: { lat: dropoffLat, lng: dropoffLng },
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === 'OK') {
            setDirections(result);
          } else {
            console.error('Error calculating route:', status);
          }
        }
      );
    }, []);

    const handleAcceptRide = async (ride) => {
      try {
        const response = await axios.post('http://localhost:5000/api/rides/accept', {
          rideId: ride.rideId,
          driverId: 'DRIVER_ID', // Replace with actual driver ID
          driverLocation: center
        });

        setCurrentRide(ride);
        setDriverStatus('in_ride');
        setRideRequests([]);
        
        // Notify rider that ride is accepted
        socket.current.emit('ride_accepted', {
          rideId: ride.rideId,
          driver: {
            name: 'John Doe', // Replace with actual driver name
            vehicle: 'Toyota Camry', // Replace with actual vehicle
            phone: '+1234567890' // Replace with actual phone
          }
        });

        // Calculate and display route
        calculateRoute(ride.pickup_lat, ride.pickup_lng, ride.dropoff_lat, ride.dropoff_lng);
      } catch (error) {
        console.error('Error accepting ride:', error);
      }
    };

    const handleCompleteRide = async () => {
      try {
        await axios.post('http://localhost:5000/api/rides/complete', {
          rideId: currentRide.rideId
        });

        setCurrentRide(null);
        setDriverStatus('available');
        setDirections(null);
      } catch (error) {
        console.error('Error completing ride:', error);
      }
    };

    const renderRideRequests = () => {
      if (rideRequests.length === 0) {
        return (
          <Typography variant="body1" color="textSecondary" sx={{ textAlign: 'center', mt: 2 }}>
            No ride requests available
          </Typography>
        );
      }

      return (
        <List sx={{ width: '100%' }}>
          {rideRequests.map((ride) => (
            <Card 
              key={ride.rideId} 
              sx={{ 
                mb: 2,
                border: ride.rideId === recommendedRideId ? '2px solid #4caf50' : 'none',
                boxShadow: ride.rideId === recommendedRideId ? theme.shadows[4] : theme.shadows[1],
                transition: 'all 0.3s ease'
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="h6">New Ride Request</Typography>
                  {ride.rideId === recommendedRideId && (
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        bgcolor: '#4caf50', 
                        color: 'white', 
                        px: 1, 
                        py: 0.5, 
                        borderRadius: 1,
                        fontWeight: 'bold'
                      }}
                    >
                      Recommended
                    </Typography>
                  )}
                </Box>
                <Typography variant="body2">From: <Box component="span" sx={{ fontWeight: 'bold' }}>{ride.pickup}</Box></Typography>
                <Typography variant="body2">To: <Box component="span" sx={{ fontWeight: 'bold' }}>{ride.dropoff}</Box></Typography>
                <Typography variant="h6" sx={{ color: '#2e7d32', fontWeight: 'bold' }}>
                  Fare: Rs.{ride.fare.toFixed(2)}
                </Typography>
               
                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => handleAcceptRide(ride)}
                  sx={{ mt: 2 }}
                >
                  Accept Ride
                </Button>
              </CardContent>
            </Card>
          ))}
        </List>
      );
    };

    const renderCurrentRide = () => {
      if (!currentRide) return null;

      return (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6">Current Ride</Typography>
            <Typography variant="body2">From: {currentRide.pickup}</Typography>
            <Typography variant="body2">To: {currentRide.dropoff}</Typography>
            <Typography variant="body2" color="primary">
              Fare: Rs.{currentRide.fare.toFixed(2)}
            </Typography>
            <Button
              variant="contained"
              color="success"
              fullWidth
              onClick={handleCompleteRide}
              sx={{ mt: 2 }}
            >
              Complete Ride
            </Button>
          </CardContent>
        </Card>
      );
    };

    if (isLoading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <CircularProgress />
        </Box>
      );
    }

    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <Header />
        <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, margin: '0 auto' }}>
          <Typography variant="h4" gutterBottom sx={{ mb: 4, fontWeight: 'bold' }}>
            Driver Dashboard
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Paper elevation={3} sx={{ p: 2, mb: 3, borderRadius: 2 }}>
                <LoadScript
                  googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
                  libraries={libraries}
                  onLoad={() => setIsMapLoaded(true)}
                >
                  {isMapLoaded ? (
                    <GoogleMap
                      mapContainerStyle={containerStyle}
                      center={center}
                      zoom={15}
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
                      {currentRide && (
                        <>
                          <Marker
                            position={{ lat: currentRide.pickup_lat, lng: currentRide.pickup_lng }}
                            label="P"
                          />
                          <Marker
                            position={{ lat: currentRide.dropoff_lat, lng: currentRide.dropoff_lng }}
                            label="D"
                          />
                        </>
                      )}
                      <Marker
                        position={center}
                        icon={{
                          path: window.google.maps.SymbolPath.CIRCLE,
                          scale: 7,
                          fillColor: '#4285F4',
                          fillOpacity: 1,
                          strokeColor: '#FFFFFF',
                          strokeWeight: 2
                        }}
                      />
                    </GoogleMap>
                  ) : (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                      <CircularProgress />
                    </Box>
                  )}
                </LoadScript>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              {driverStatus === 'available' ? renderRideRequests() : renderCurrentRide()}
            </Grid>
          </Grid>
        </Box>
      </Box>
    );
  }

  export default DriverPage; 