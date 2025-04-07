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
    min_price: float = 5.0
    max_price: float = 150.0
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
            # Step 1: Generate ML model input features
            ml_input = self._prepare_ml_input(request)
            logger.info(f"ML Input Features:\n{ml_input}")  # Log input features
            
            # Step 2: Predict base fare using ML model
            base_fare = self.fare_model.predict(ml_input)[0]
            logger.info(f"Predicted Base Fare: {base_fare}")  # Log base fare
            
            # Step 3: Calculate surge multiplier (existing logic)
            hour = time.localtime(request.timestamp).tm_hour
            predicted_demand = self.demand_forecaster.predict_demand(hour)
            demand_supply_ratio = predicted_demand / (current_supply + 1e-6)
            surge_multiplier = self._calculate_surge(demand_supply_ratio)
            logger.info(f"Demand/Supply Ratio: {demand_supply_ratio}, Surge Multiplier: {surge_multiplier}")  # Log surge multiplier
            
            # Step 4: Apply real-time adjustments
            surge_multiplier *= self._get_zone_multiplier(request.zone)
            surge_multiplier *= 1 + (request.traffic_blocks / 10)  # Use traffic_blocks from request
            logger.info(f"Adjusted Surge Multiplier: {surge_multiplier}")  # Log adjusted surge multiplier
            
            # Step 5: Apply personalization
            final_price = base_fare * surge_multiplier * user.price_sensitivity
            
            if user.loyalty_tier >= 4:
                final_price *= 0.9  # 10% discount
            
            final_price = round(max(self.config.min_price, min(final_price, self.config.max_price)), 2)
            logger.info(f"Final Price: {final_price}")  # Log final price
            
            return final_price
            
        except Exception as e:
            logger.error(f"Pricing error: {str(e)}")
            return self.config.min_price

    def _prepare_ml_input(self, request: TripRequest) -> pd.DataFrame:
        """Prepare input features for the ML fare model."""
        hour_of_day = time.localtime(request.timestamp).tm_hour  # Extract hour of the day

        # Create a DataFrame with all required features
        input_data = pd.DataFrame({
            'distance_km': [request.distance * 1.60934],  # Convert miles to km
            'traffic_level': [request.traffic_level],
            'ride_demand_level': [request.ride_demand_level],
            'holiday': [int(request.is_holiday)],  # Use is_holiday from request
            'event_nearby': [int(request.is_event_nearby)],  # Use is_event_nearby from request
            'hour_of_day': [hour_of_day],  # Use hour_of_day instead of time_category
            'weather_severity': [request.weather_severity],  # Use weather_severity from request
            'traffic_impact': [request.traffic_level * request.traffic_blocks]  # Use traffic_blocks from request
        })

        # Ensure the DataFrame has the same columns as the training data
        expected_columns = [
            'distance_km', 'traffic_level', 'ride_demand_level', 'holiday', 'event_nearby',
            'hour_of_day',  # Replace time_category with hour_of_day
            'weather_severity', 'traffic_impact'
        ]

        # Add missing columns with default values (0)
        for col in expected_columns:
            if col not in input_data.columns:
                input_data[col] = 0

        # Reorder columns to match the training data
        input_data = input_data[expected_columns]

        return input_data

    def _calculate_surge(self, ratio: float) -> float:
        if ratio > self.config.surge_threshold:
            surge = min(1 + (ratio - self.config.surge_threshold) * self.config.surge_scaling, 3.0)
            logger.info(f"Surge Applied: {surge}")  # Log surge value
            return surge
        return 1.0

    def _get_zone_multiplier(self, zone: str) -> float:
        multipliers = {"airport": 1.3, "downtown": 1.2, "suburb": 0.9}
        return multipliers.get(zone, 1.0)