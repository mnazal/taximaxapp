from flask import Flask, request, jsonify
from profitability_evaluatorV2 import RequestEvaluator, DriverProfile, TripRequest, UserProfile, PricingEngine, PricingConfig
from dataclasses import asdict
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Initialize pricing engine and evaluator
config = PricingConfig()
pricing_engine = PricingEngine(config)
evaluator = RequestEvaluator(pricing_engine)

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
        requests_data = data.get('trip_requests', [])
        trip_requests = [
            TripRequest(**request_data)
            for request_data in requests_data
        ]
        
        # Extract current supply (optional, default to 20)
        current_supply = data.get('current_supply', 20)
        
        # Rank requests
        ranked_requests = evaluator.rank_requests(trip_requests, driver, user_profiles, current_supply)
        
        # Convert ranked requests to JSON-friendly format
        ranked_requests_json = [
            {
                "request_id": score.request_id,
                "fare": score.fare,
                "profit": score.profit,
                "deadhead_distance": score.deadhead_distance,
                "pickup_time": score.pickup_time,
                "total_time": score.total_time,
                "profit_per_minute": score.profit_per_minute,
                "profit_per_mile": score.profit_per_mile,
                "surge_factor": score.surge_factor,
                "opportunity_cost": score.opportunity_cost,
                "final_score": score.final_score,
                "request": asdict(score.request)  # Convert TripRequest to dict
            }
            for score in ranked_requests
        ]
        
        # Return ranked requests as JSON
        return jsonify({
            "status": "success",
            "ranked_requests": ranked_requests_json
        })
    
    except Exception as e:
        logger.error(f"Error processing request: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, port=8003)