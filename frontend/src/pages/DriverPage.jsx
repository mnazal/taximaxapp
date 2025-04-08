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
      const payload = {
        driver_profile: {
          current_location: "downtown",
          current_fuel: 80.0,
          shift_remaining_time: 120.0,
          earnings_today: 180.0,
          earnings_target: 250.0,
          vehicle_mpg: 25.0,
          cost_per_mile: 0.32,
          return_to_base: true,
          base_location: "downtown",
          min_acceptable_fare: 8.0
        },
        rideRequests: requests, // Use the properly formatted API rides
        current_supply: 20
      };
    
      console.log("Payload being sent to API:", JSON.stringify(payload, null, 2));
    
      try {
        const response = await axios.post('http://localhost:8003/rank-requests', payload);
        const recommendedRideId = response.data.optimised_rideid;
        setRecommendedRideId(recommendedRideId);
    
        console.log("Response from API:", response.data);
      } catch (error) {
        console.error('Error getting recommended ride:', error.response?.data || error.message);
      }
    }, [center, recommendedRideRequests]); // Add recommendedRideRequests to dependencies

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
                border: ride.rideId === recommendedRideId ? `2px solid ${theme.palette.primary.main}` : 'none',
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
                        bgcolor: 'primary.main', 
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
                <Typography variant="body2">From: {ride.pickup}</Typography>
                <Typography variant="body2">To: {ride.dropoff}</Typography>
                <Typography variant="body2" color="primary">
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