from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from pricing_engine import PricingEngine, TripRequest, UserProfile, PricingConfig
import time

# Initialize FastAPI app
app = FastAPI()

# Load the pricing engine
config = PricingConfig()
pricing_engine = PricingEngine(config)

# Define request models for the API
class TripRequestModel(BaseModel):
    user_id: str
    distance: float
    duration: float
    zone: str
    ride_demand_level: int
    traffic_level: int
    weather_severity: int  # New field for real-time weather
    traffic_blocks: int    # New field for real-time traffic
    is_holiday: bool       # New field for real-time holiday status
    is_event_nearby: bool  # New field for real-time event status

class UserProfileModel(BaseModel):
    loyalty_tier: int
    price_sensitivity: float

class PricingRequest(BaseModel):
    trip_request: TripRequestModel
    user_profile: UserProfileModel
    current_supply: int

# Define the API endpoint
@app.post("/calculate_price")
def calculate_price(request: PricingRequest):
    try:
        # Convert API request to the internal data models
        trip_request = TripRequest(
            user_id=request.trip_request.user_id,
            distance=request.trip_request.distance,
            duration=request.trip_request.duration,
            zone=request.trip_request.zone,
            timestamp=time.time(),
            ride_demand_level=request.trip_request.ride_demand_level,
            traffic_level=request.trip_request.traffic_level,
            weather_severity=request.trip_request.weather_severity,  # Pass real-time weather
            traffic_blocks=request.trip_request.traffic_blocks,      # Pass real-time traffic
            is_holiday=request.trip_request.is_holiday,              # Pass real-time holiday status
            is_event_nearby=request.trip_request.is_event_nearby     # Pass real-time event status
        )

        user_profile = UserProfile(
            loyalty_tier=request.user_profile.loyalty_tier,
            price_sensitivity=request.user_profile.price_sensitivity
        )

        # Calculate the price
        price = pricing_engine.calculate_price(
            request=trip_request,
            user=user_profile,
            current_supply=request.current_supply
        )

        return {"price": price}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Run the API
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)