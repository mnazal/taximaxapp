import numpy as np
import pandas as pd
from dataclasses import dataclass
from typing import List, Dict, Optional
import logging
from pricing_engine import PricingEngine, TripRequest, UserProfile, PricingConfig

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class DriverProfile:
    """Profile containing driver preferences and status"""
    current_location: str  # zone identifier
    current_fuel: float    # fuel level in percentage
    shift_remaining_time: float  # minutes remaining in shift
    earnings_today: float  # total earnings so far
    earnings_target: float # target earnings for the day
    vehicle_mpg: float     # miles per gallon fuel efficiency
    cost_per_mile: float   # operational cost per mile (including fuel, maintenance)
    return_to_base: bool   # whether driver needs to return to specific location at end of shift
    base_location: Optional[str] = None  # location to return to if applicable
    min_acceptable_fare: float = 5.0  # minimum fare to accept

@dataclass
class RequestScore:
    """Detailed scoring of a trip request"""
    request_id: str
    fare: float
    profit: float  # Fare - costs
    deadhead_distance: float  # Distance to pickup
    pickup_time: float  # Time to pickup
    total_time: float  # Pickup + trip + potential return
    profit_per_minute: float
    profit_per_mile: float
    surge_factor: float
    opportunity_cost: float  # Potential lost opportunity
    final_score: float  # Overall weighted score
    request: TripRequest  # Original request

class RequestEvaluator:
    """Evaluates multiple requests to find the most profitable one"""
   
    def __init__(self, pricing_engine):  # Fixed: Added pricing_engine parameter
        self.pricing_engine = pricing_engine
        # Default weights for different factors
        self.score_weights = {
            "profit": 0.35,
            "profit_per_minute": 0.25,
            "profit_per_mile": 0.15,
            "pickup_time": -0.10,  # Negative because shorter is better
            "surge_factor": 0.05,
            "opportunity_cost": -0.10  # Negative because lower is better
        }
   
    def set_weights(self, weights: Dict[str, float]):
        """Update scoring weights"""
        self.score_weights = weights
   
    def calculate_deadhead_costs(self, driver_zone: str, request_zone: str, driver_location=None, pickup_location=None) -> dict:
        """Calculate distance and time to pickup location"""
        # In a real system, this would use geospatial data and routing APIs
        # For this example, using a simplified zone-based approach
       
        # Zone distance matrix (simplified)
        zone_distances = {
            ("downtown", "downtown"): {"miles": 1.5, "minutes": 8},
            ("downtown", "suburb"): {"miles": 5.0, "minutes": 12},
            ("downtown", "airport"): {"miles": 10.0, "minutes": 18},
            ("suburb", "downtown"): {"miles": 5.0, "minutes": 12},
            ("suburb", "suburb"): {"miles": 2.0, "minutes": 6},
            ("suburb", "airport"): {"miles": 8.0, "minutes": 15},
            ("airport", "downtown"): {"miles": 10.0, "minutes": 18},
            ("airport", "suburb"): {"miles": 8.0, "minutes": 15},
            ("airport", "airport"): {"miles": 1.0, "minutes": 5},
        }
       
        # Get distance and time or use defaults if zones not found
        default = {"miles": 3.0, "minutes": 10}
        return zone_distances.get((driver_zone, request_zone), default)
   
    def evaluate_request(self, request: TripRequest, driver: DriverProfile, user: UserProfile, current_supply: int) -> RequestScore:
        """Evaluate a single request and return its profitability score"""
        # Calculate fare using pricing engine
        fare = self.pricing_engine.calculate_price(request, user, current_supply)
       
        # Get deadhead costs (distance and time to pickup)
        deadhead = self.calculate_deadhead_costs(driver.current_location, request.zone)
        deadhead_distance = deadhead["miles"]
        pickup_time = deadhead["minutes"]
       
        # Calculate total operating costs
        total_distance = deadhead_distance + request.distance
        operating_cost = total_distance * driver.cost_per_mile
       
        # Calculate profit
        profit = fare - operating_cost
       
        # Calculate time commitment
        total_time = pickup_time + request.duration
       
        # Add return trip time if needed and shift is ending
        minutes_after_trip = driver.shift_remaining_time - total_time
        return_trip_time = 0
       
        if driver.return_to_base and minutes_after_trip < 30:
            # Calculate return trip time if we're near end of shift
            return_trip = self.calculate_deadhead_costs(request.zone, driver.base_location or "downtown")
            return_trip_time = return_trip["minutes"]
            total_time += return_trip_time
       
        # Calculate efficiency metrics
        profit_per_minute = profit / max(total_time, 1)
        profit_per_mile = profit / max(total_distance, 0.1)
       
        # Determine surge factor by checking if price is higher than base
        # This is an estimation since we don't have direct access to the surge multiplier
        estimated_base = (7 + (1.5 * request.distance) + (0.2 * request.duration))
        surge_factor = fare / max(estimated_base, 1)
       
        # Opportunity cost - potential lost fare if this trip takes too long
        # Higher during peak hours
        hour = int((request.timestamp % 86400) / 3600)
        peak_hours = [7, 8, 9, 17, 18, 19]
        opportunity_cost = 0
       
        if hour in peak_hours:
            opportunity_cost = total_time * 0.5  # Higher opportunity cost during peak hours
        else:
            opportunity_cost = total_time * 0.2
           
        # Check if driver can complete the trip in their remaining shift
        if total_time > driver.shift_remaining_time:
            logger.info(f"Trip exceeds remaining shift time: {total_time} > {driver.shift_remaining_time}")
            opportunity_cost *= 3  # Heavily penalize trips that go beyond shift
       
        # Calculate final score using weighted factors
        final_score = (
            self.score_weights["profit"] * profit +
            self.score_weights["profit_per_minute"] * profit_per_minute +
            self.score_weights["profit_per_mile"] * profit_per_mile +
            self.score_weights["pickup_time"] * pickup_time +  # Negative weight makes shorter better
            self.score_weights["surge_factor"] * surge_factor +
            self.score_weights["opportunity_cost"] * opportunity_cost  # Negative weight makes lower better
        )
       
        # Create request ID
        request_id = f"{request.user_id}_{request.timestamp}"
       
        return RequestScore(
            request_id=request_id,
            fare=fare,
            profit=profit,
            deadhead_distance=deadhead_distance,
            pickup_time=pickup_time,
            total_time=total_time,
            profit_per_minute=profit_per_minute,
            profit_per_mile=profit_per_mile,
            surge_factor=surge_factor,
            opportunity_cost=opportunity_cost,
            final_score=final_score,
            request=request
        )
   
    def rank_requests(self, requests: List[TripRequest], driver: DriverProfile, user_profiles: Dict[str, UserProfile], current_supply: int) -> List[RequestScore]:
        """Rank multiple requests by profitability score"""
        scores = []
       
        for request in requests:
            # Get user profile or use default
            user = user_profiles.get(request.user_id, UserProfile())
           
            # Score the request
            score = self.evaluate_request(request, driver, user, current_supply)
            scores.append(score)
           
            # Log the score details
            logger.info(f"Request {score.request_id}: Score={score.final_score:.2f}, Profit=${score.profit:.2f}, "
                        f"Fare=${score.fare:.2f}, Profit/Min=${score.profit_per_minute:.2f}")
       
        # Sort by final score, highest first
        return sorted(scores, key=lambda x: x.final_score, reverse=True)
   
    def get_best_request(self, requests: List[TripRequest], driver: DriverProfile, user_profiles: Dict[str, UserProfile], current_supply: int) -> Optional[RequestScore]:
        """Get the most profitable request"""
        ranked_requests = self.rank_requests(requests, driver, user_profiles, current_supply)
       
        if not ranked_requests:
            return None
           
        best_request = ranked_requests[0]
       
        # Only return if it meets minimum criteria
        if best_request.fare < driver.min_acceptable_fare:
            logger.info(f"Best request fare (${best_request.fare:.2f}) below driver minimum (${driver.min_acceptable_fare:.2f})")
            return None
           
        return best_request


# Example usage
def demo_request_evaluator():
    # Initialize pricing engine
    config = PricingConfig()
    pricing_engine = PricingEngine(config)
   
    # Initialize evaluator
    evaluator = RequestEvaluator(pricing_engine)  # Now this should work
   
    # Create driver profile
    driver = DriverProfile(
        current_location="downtown",
        current_fuel=80.0,
        shift_remaining_time=120.0,  # 2 hours left
        earnings_today=180.0,
        earnings_target=250.0,
        vehicle_mpg=25.0,
        cost_per_mile=0.32,  # includes gas, maintenance, depreciation
        return_to_base=True,
        base_location="downtown",
        min_acceptable_fare=8.0
    )
   
    # Create sample requests
    current_time = 1647889200  # Example timestamp
   
    requests = [
        TripRequest(
            user_id="user1",
            distance=3.5,
            duration=12.0,
            zone="downtown",
            timestamp=current_time,
            ride_demand_level=3,
            traffic_level=2,
            weather_severity=0,
            traffic_blocks=2,
            is_holiday=False,
            is_event_nearby=False
        ),
        TripRequest(
            user_id="user2",
            distance=8.2,
            duration=25.0,
            zone="suburb",
            timestamp=current_time,
            ride_demand_level=2,
            traffic_level=1,
            weather_severity=0,
            traffic_blocks=1,
            is_holiday=False,
            is_event_nearby=False
        ),
        TripRequest(
            user_id="user3",
            distance=12.5,
            duration=35.0,
            zone="airport",
            timestamp=current_time,
            ride_demand_level=4,
            traffic_level=3,
            weather_severity=1,
            traffic_blocks=3,
            is_holiday=False,
            is_event_nearby=True
        )
    ]
   
    # Create user profiles
    user_profiles = {
        "user1": UserProfile(loyalty_tier=2, price_sensitivity=1.0),
        "user2": UserProfile(loyalty_tier=3, price_sensitivity=0.9),
        "user3": UserProfile(loyalty_tier=5, price_sensitivity=1.2)
    }
   
    # Find the best request
    best_request = evaluator.get_best_request(requests, driver, user_profiles, current_supply=20)
   
    if best_request:
        print(f"\nBest Request: {best_request.request_id}")
        print(f"Fare: ${best_request.fare:.2f}")
        print(f"Profit: ${best_request.profit:.2f}")
        print(f"Profit per minute: ${best_request.profit_per_minute:.2f}")
        print(f"Profit per mile: ${best_request.profit_per_mile:.2f}")
        print(f"Pickup time: {best_request.pickup_time:.1f} minutes")
        print(f"Total time: {best_request.total_time:.1f} minutes")
        print(f"Distance: {best_request.request.distance:.1f} miles + {best_request.deadhead_distance:.1f} miles deadhead")
        print(f"Final score: {best_request.final_score:.2f}")
    else:
        print("No suitable requests found.")


if __name__ == "__main__":
    demo_request_evaluator()