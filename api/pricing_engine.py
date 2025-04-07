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
    min_price: float = 40
    max_price: float = 50000
    surge_threshold: float = 1.2  # Demand/supply ratio to trigger surge
    surge_scaling: float = 0.5    # Multiplier aggressiveness

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
            
            # Step 1: Calculate formula-based fare
            base_rate = 30  # Reduced from 40
            distance_rate = 8.5  # Reduced from 10.5
            time_rate = 0.8  # Reduced from 1
            
            formula_fare = base_rate + (distance_rate * distance_km) + (time_rate * request.duration)
            logger.info(f"Formula-based Fare: {formula_fare}")
            
            # Step 2: Get ML model prediction
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
            
            # Step 3: Ensure ML prediction is reasonable
            min_fare = formula_fare * 0.8
            max_fare = formula_fare * 1.2
            
            # If ML prediction is too far off from formula, use formula with a small adjustment
            if ml_fare < min_fare or ml_fare > max_fare:
                base_fare = formula_fare * (0.9 if ml_fare < min_fare else 1.1)
            else:
                base_fare = ml_fare
            
            logger.info(f"Selected Base Fare: {base_fare}")
            
            # Step 4: Calculate surge multiplier
            hour = time.localtime(request.timestamp).tm_hour
            predicted_demand = self.demand_forecaster.predict_demand(hour)
            demand_supply_ratio = predicted_demand / (current_supply + 1e-6)
            surge_multiplier = self._calculate_surge(demand_supply_ratio)
            logger.info(f"Demand/Supply Ratio: {demand_supply_ratio}, Surge Multiplier: {surge_multiplier}")
            
            # Step 5: Apply real-time adjustments
            zone_multiplier = self._get_zone_multiplier(request.zone)
            traffic_multiplier = 1 + (request.traffic_blocks / 10)
            weather_multiplier = self._get_weather_multiplier(request.weather_severity)
            
            total_multiplier = surge_multiplier * zone_multiplier * traffic_multiplier * weather_multiplier
            logger.info(f"Total Multiplier: {total_multiplier}")
            
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
        if ratio > self.config.surge_threshold:
            surge = min(1 + (ratio - self.config.surge_threshold) * self.config.surge_scaling, 3.0)
            logger.info(f"Surge Applied: {surge}")  # Log surge value
            return surge
        return 1.0

    def _get_zone_multiplier(self, zone: str) -> float:
        multipliers = {"airport": 1.3, "downtown": 1.2, "suburb": 0.9}
        return multipliers.get(zone, 1.0)

    def _get_weather_multiplier(self, weather: str) -> float:
        """Get multiplier based on weather severity."""
        multipliers = {
            'Clear': 1.0,
            'Rainy': 1.2,
            'Foggy': 1.3,
            'Snowy': 1.5
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