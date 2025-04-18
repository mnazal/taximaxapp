from flask import Flask, request, jsonify
from profitability_evaluatorV2 import RequestEvaluator, DriverProfile, TripRequest, UserProfile, PricingEngine, PricingConfig
from dataclasses import asdict
import logging
import time
from flask_cors import CORS

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Initialize pricing engine and evaluator
config = PricingConfig()
pricing_engine = PricingEngine(config)
evaluator = RequestEvaluator()


@app.route("/calculate_price", methods=["POST"])
def calculate_price():
    try:
        data = request.json
        
        trip_request = TripRequest(
            user_id=data['trip_request']['user_id'],
            distance=data['trip_request']['distance'],
            duration=data['trip_request']['duration'],
            zone=data['trip_request'].get('zone', "downtown"),
            timestamp=time.time(),
            ride_demand_level=data['trip_request'].get('ride_demand_level', 4),
            traffic_level=data['trip_request'].get('traffic_level', 3),
            weather_severity=data['trip_request'].get('weather_severity', 2),
            traffic_blocks=data['trip_request'].get('traffic_blocks', 3),
            is_holiday=data['trip_request'].get('is_holiday', False),
            is_event_nearby=data['trip_request'].get('is_event_nearby', False),
            fare=0  # Initialize with 0, will be calculated
        )

        user_profile = UserProfile(
            loyalty_tier=data['user_profile'].get('loyalty_tier', 4),
            price_sensitivity=data['user_profile'].get('price_sensitivity', 0.95)
        )

        price = pricing_engine.calculate_price(
            request=trip_request,
            user=user_profile,
            current_supply=data.get('current_supply', 20)
        )

        return jsonify({"fare": price})

    except Exception as e:
        logger.error(f"Error calculating price: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/rank-requests', methods=['POST'])
def rank_requests():
    """
    API endpoint to rank trip requests based on profitability.
    Expects JSON input with driver profile, user profiles, and trip requests.
    """
    try:
        # Parse JSON input
        data = request.json
        
        # Extract driver profile
        driver_data = data.get('driver_profile')
        driver = DriverProfile(**driver_data)
        
        # Extract user profiles
        user_profiles_data = data.get('user_profiles', {})
        user_profiles = {
            user_id: UserProfile(**profile_data)
            for user_id, profile_data in user_profiles_data.items()
        }
        
        # Extract trip requests
        requests_data = data.get('rideRequests', [])
        trip_requests = [
            TripRequest(**request_data)
            for request_data in requests_data
        ]
        
        # Extract current supply (optional, default to 20)
        current_supply = data.get('current_supply', 20)
        
        # Rank requests and get the best one
        best_request = evaluator.rank_requests(trip_requests, driver, user_profiles, current_supply)
        
        if best_request:
            # Convert best request to JSON-friendly format
            ranked_requests_json = {

                "request_id": best_request.request_id,
                "fare": best_request.fare,
                "profit": best_request.profit,
                "deadhead_distance": best_request.deadhead_distance,
                "pickup_time": best_request.pickup_time,
                "total_time": best_request.total_time,
                "profit_per_minute": best_request.profit_per_minute,
                "profit_per_mile": best_request.profit_per_mile,
                "surge_factor": best_request.surge_factor,
                "opportunity_cost": best_request.opportunity_cost,
                "final_score": best_request.final_score,
                "request": asdict(best_request.request)  # Convert TripRequest to dict
            }
            
            # Return ranked requests as JSON
            return jsonify({
                "status": "success",
                "optimised_rideid": ranked_requests_json["request_id"]  # Fixed: Use dictionary access
            })
        else:
            return jsonify({
                "status": "no_suitable_requests",
                "message": "No suitable requests found."
            })
    
    except Exception as e:
        logger.error(f"Error processing request: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, port=8003)