import time
import logging
import joblib
import pandas as pd
from dataclasses import dataclass
from typing import Dict, Optional
import numpy as np
from sklearn.linear_model import LinearRegression

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ========== Data Models ==========
@dataclass
class PricingConfig:
    # Base fare components
    base_fare: float = 30       # Base fare for any ride
    per_km_rate: float = 8.5    # Rate per kilometer
    per_min_rate: float = 0.8   # Rate per minute
    booking_fee: float = 10     # Fixed booking fee
    
    # Price limits
    min_price: float = 40       # Minimum fare
    max_price: float = 50000    # Maximum fare
    
    # Surge settings
    surge_threshold: float = 1.4 # Industry standard threshold for surge
    surge_scaling: float = 0.4   # Standard surge progression rate
    
    # Time-based rate adjustments
    night_rate_multiplier: float = 1.1  # For rides between 11 PM and 5 AM
    peak_rate_multiplier: float = 1.2   # For peak hours (8-10 AM, 4-7 PM)

@dataclass
class TripRequest:
    user_id: str
    distance: float         # miles
    duration: float         # minutes
    zone: str               # e.g., "downtown", "suburb"
    timestamp: float        # UNIX timestamp
    ride_demand_level: int  # New field for ML model
    traffic_level: int      # New field for ML model
    weather_severity: int   # Real-time weather data (0=Clear, 1=Rainy, 2=Snowy, 3=Foggy)
    traffic_blocks: int     # Real-time traffic blocks (1-5)
    is_holiday: bool        # Real-time holiday status
    is_event_nearby: bool   # Real-time event status
    fare: float=None
    rideId:int=None

@dataclass
class UserProfile:
    loyalty_tier: int = 1   # 1 (low) to 5 (high)
    price_sensitivity: float = 1.0  # 1.0 (neutral), <1 (discount), >1 (premium)

# ========== Demand Forecaster ==========
class DemandForecaster:
    """Predicts future demand using simple linear regression."""
    
    def __init__(self):
        self.model = LinearRegression()
    
    def train(self, historical_data: np.ndarray):
        # Historical data format: [hour_of_day, demand]
        X = historical_data[:, 0].reshape(-1, 1)  # hour_of_day
        y = historical_data[:, 1]  # demand
        self.model.fit(X, y)
    
    def predict_demand(self, hour: int) -> float:
        return self.model.predict(np.array([[hour]]))[0]

# ========== Core Pricing Engine ==========
class PricingEngine:
    def __init__(self, config: PricingConfig):
        self.config = config
        self.demand_forecaster = DemandForecaster()
        self.fare_model = joblib.load("dynamic_pricing_model.joblib")  # Load ML model
        self._load_historical_data()
        
    def _load_historical_data(self):
        # Simulated training data (hour, demand)
        historical_data = np.array([
            [9, 50], [10, 80], [11, 100],  # Morning peak
            [17, 120], [18, 150], [19, 130]  # Evening peak
        ])
        self.demand_forecaster.train(historical_data)
    
    def calculate_price(
        self,
        request: TripRequest,
        user: UserProfile,
        current_supply: int
    ) -> float:
        try:
            logger.info(f"Request: {request}")
            
            # Convert distance from miles to kilometers
            distance_km = request.distance * 1.60934
            
            # Step 1: Calculate base fare using rates
            base_fare = self.config.base_fare + \
                       (self.config.per_km_rate * distance_km) + \
                       (self.config.per_min_rate * request.duration) + \
                       self.config.booking_fee
            
            # Apply time-based rate adjustments
            current_hour = time.localtime(request.timestamp).tm_hour
            if 23 <= current_hour or current_hour <= 5:
                base_fare *= self.config.night_rate_multiplier
            elif (8 <= current_hour <= 10) or (16 <= current_hour <= 19):
                base_fare *= self.config.peak_rate_multiplier
            
            logger.info(f"Calculated Base Fare: {base_fare}")
            
            # Step 2: Get ML model prediction for comparison
            ml_input = self._prepare_ml_input(
                distance_km=distance_km,
                time_of_day=time.localtime(request.timestamp).tm_hour,
                traffic_level=request.traffic_level,
                weather_condition=request.weather_severity,
                traffic_blocks=request.traffic_blocks,
                holiday=1 if request.is_holiday else 0,
                event_nearby=1 if request.is_event_nearby else 0,
                ride_demand_level=request.ride_demand_level
            )
            ml_fare = self.fare_model.predict(ml_input)[0]
            logger.info(f"ML Model Fare: {ml_fare}")
            
            # Use weighted average of calculated base fare and ML prediction
            base_fare = (0.6 * base_fare) + (0.4 * ml_fare)  # 60% base fare, 40% ML
            logger.info(f"Final Base Fare: {base_fare}")
            
            # Step 2: Calculate demand/supply ratio with time-based weighting
            current_hour = time.localtime(request.timestamp).tm_hour
            predicted_demand = self.demand_forecaster.predict_demand(current_hour)
            
            # Apply time-based weight to demand
            time_weight = 1.0
            if 8 <= current_hour <= 10 or 16 <= current_hour <= 19:  # Peak hours
                time_weight = 1.2
            elif 23 <= current_hour or current_hour <= 4:  # Late night
                time_weight = 1.1
            
            effective_demand = predicted_demand * time_weight
            demand_supply_ratio = effective_demand / max(current_supply, 1)
            
            # Step 3: Calculate surge with more realistic progression
            surge_multiplier = self._calculate_surge(demand_supply_ratio)
            logger.info(f"Hour: {current_hour}, Demand/Supply: {demand_supply_ratio}, Surge: {surge_multiplier}")
            
            # Step 4: Calculate other multipliers
            zone_multiplier = self._get_zone_multiplier(request.zone)
            
            # Traffic multiplier based on actual congestion
            traffic_impact = min(request.traffic_blocks / 5, 1.0)  # Normalize to 0-1
            traffic_multiplier = 1.0 + (traffic_impact * 0.2)  # Max 20% increase
            
            # Weather multiplier with moderate impact
            weather_multiplier = self._get_weather_multiplier(request.weather_severity)
            
            # Calculate total multiplier with balanced weights
            raw_multiplier = (
                (surge_multiplier * 0.4) +  # 40% weight to surge
                (zone_multiplier * 0.2) +   # 20% weight to zone
                (traffic_multiplier * 0.2) + # 20% weight to traffic
                (weather_multiplier * 0.2)   # 20% weight to weather
            )
            
            # Ensure multiplier stays within realistic bounds
            total_multiplier = max(0.8, min(raw_multiplier, 2.0))
            logger.info(f"Raw Multiplier: {raw_multiplier}, Final Multiplier: {total_multiplier}")
            
            # Step 6: Apply personalization
            final_price = base_fare * total_multiplier * user.price_sensitivity
            
            if user.loyalty_tier >= 4:
                final_price *= 0.9  # 10% discount
            
            final_price = round(max(self.config.min_price, min(final_price, self.config.max_price)), 2)
            logger.info(f"Final Price: {final_price}")
            
            return final_price
            
        except Exception as e:
            logger.error(f"Pricing error: {str(e)}")
            return self.config.min_price

    def _calculate_surge(self, ratio: float) -> float:
        """Calculate surge price using industry-standard approach"""
        if ratio <= 1.0:
            return 1.0
            
        # Progressive surge calculation using sigmoid function
        # This creates a smooth curve that plateaus at high demand
        normalized_ratio = (ratio - 1.0) / (self.config.surge_threshold - 1.0)
        sigmoid = 1 / (1 + np.exp(-4 * (normalized_ratio - 0.5)))
        
        # Scale sigmoid output to surge range (1.0 to 1.8)
        surge = 1.0 + (sigmoid * 0.8)
        
        # Add small random variation (±5%)
        variation = 1.0 + np.random.uniform(-0.05, 0.05)
        surge *= variation
        
        # Ensure bounds
        surge = max(1.0, min(surge, 1.8))
        
        logger.info(f"Ratio: {ratio:.2f}, Normalized: {normalized_ratio:.2f}, Surge: {surge:.2f}")
        return surge

    def _get_zone_multiplier(self, zone: str) -> float:
        """Get zone-based multiplier using industry standards"""
        multipliers = {
            "airport": 1.12,     # 12% premium for airport rides
            "downtown": 1.08,   # 8% premium for downtown
            "suburb": 0.95      # 5% discount for suburbs
        }
        return multipliers.get(zone, 1.0)

    def _get_weather_multiplier(self, weather: str) -> float:
        """Get weather-based multiplier using industry standards"""
        multipliers = {
            'Clear': 1.0,      # Base rate
            'Rainy': 1.08,     # 8% increase
            'Foggy': 1.12,     # 12% increase
            'Snowy': 1.15      # 15% increase
        }
        return multipliers.get(weather, 1.0)

    def _prepare_ml_input(self, distance_km, time_of_day, traffic_level, weather_condition, traffic_blocks, holiday, event_nearby, ride_demand_level):
        """Prepare input data for the ML model."""
        # Create a DataFrame with the input features
        input_data = pd.DataFrame({
            'distance_km': [distance_km],
            'time_of_day': [time_of_day],
            'traffic_level': [traffic_level],
            'weather_severity': [weather_condition],  # Already numeric from TripRequest
            'traffic_blocks': [traffic_blocks],
            'holiday': [holiday],
            'event_nearby': [event_nearby],
            'ride_demand_level': [ride_demand_level]
        })
        
        # Add time-based features
        input_data['hour_of_day'] = input_data['time_of_day']
        input_data['is_peak_hour'] = input_data['hour_of_day'].apply(lambda x: 1 if x in [7,8,9,17,18,19] else 0)
        input_data['is_night'] = input_data['hour_of_day'].apply(lambda x: 1 if x in list(range(22,24)) + list(range(0,6)) else 0)
        
        # Add distance-based features
        input_data['distance_squared'] = input_data['distance_km'] ** 2
        input_data['log_distance'] = np.log1p(input_data['distance_km'])
        
        # Calculate traffic impact
        input_data['traffic_impact'] = input_data['traffic_level'] * input_data['traffic_blocks']
        
        # Add special event features
        input_data['special_conditions'] = input_data['holiday'] + input_data['event_nearby']
        
        # Select and order features to match training data
        selected_features = [
            'distance_km', 'traffic_level', 'ride_demand_level',
            'traffic_impact', 'weather_severity', 'hour_of_day',
            'is_peak_hour', 'is_night', 'distance_squared', 'log_distance',
            'special_conditions'
        ]
        
        return input_data[selected_features]