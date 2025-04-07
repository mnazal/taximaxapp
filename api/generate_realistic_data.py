import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random

def generate_realistic_data(num_samples=10000):
    """Generate realistic taxi fare data in rupees."""
    
    # Base rates in rupees
    BASE_FARE = 30  # Reduced from 40
    MIN_PER_KM = 7  # Reduced from 9
    MAX_PER_KM = 10  # Reduced from 12
    PER_MINUTE_RATE = 0.8  # Reduced from 1
    
    # Generate timestamps for the last 3 months
    end_date = datetime.now()
    start_date = end_date - timedelta(days=90)
    timestamps = [start_date + timedelta(seconds=random.randint(0, 90*24*3600)) for _ in range(num_samples)]
    
    # Generate realistic distances (in km)
    distances = np.random.lognormal(1.5, 0.5, num_samples)  # More realistic distance distribution
    distances = np.clip(distances, 1, 30)  # Limit between 1-30km
    
    # Generate realistic durations (in minutes)
    avg_speed = 20  # Average speed in km/h
    durations = (distances * 60 / avg_speed) + np.random.normal(0, 5, num_samples)  # Convert to minutes
    durations = np.clip(durations, 5, 120)  # Limit between 5-120 minutes
    
    # Generate traffic levels (1-5)
    traffic_levels = np.random.randint(1, 6, num_samples)
    
    # Generate weather conditions with realistic probabilities
    weather_conditions = np.random.choice(
        ['Clear', 'Rainy', 'Foggy', 'Snowy'],
        num_samples,
        p=[0.6, 0.25, 0.1, 0.05]  # More likely to be clear
    )
    
    # Generate traffic blocks (0-4)
    traffic_blocks = np.random.randint(0, 5, num_samples)
    
    # Generate holidays (more likely on weekends)
    is_holiday = np.random.choice([0, 1], num_samples, p=[0.95, 0.05])
    
    # Generate events (rare)
    is_event = np.random.choice([0, 1], num_samples, p=[0.98, 0.02])
    
    # Generate ride demand levels (1-5)
    ride_demands = np.random.randint(1, 6, num_samples)
    
    # Calculate base fares with distance-based rate variation
    per_km_rates = np.random.uniform(MIN_PER_KM, MAX_PER_KM, num_samples)
    base_fares = BASE_FARE + (distances * per_km_rates) + (durations * PER_MINUTE_RATE)
    
    # Apply multipliers based on conditions
    final_fares = base_fares.copy()
    
    # Traffic multiplier (higher impact on longer distances)
    traffic_impact = 1 + (traffic_levels - 1) * 0.1 * (1 + distances / 30)
    final_fares *= traffic_impact
    
    # Weather multiplier
    weather_multipliers = {
        'Clear': 1.0,
        'Rainy': 1.2,
        'Foggy': 1.3,
        'Snowy': 1.5
    }
    for i, weather in enumerate(weather_conditions):
        final_fares[i] *= weather_multipliers[weather]
    
    # Traffic blocks multiplier (higher impact on longer distances)
    traffic_block_impact = 1 + traffic_blocks * 0.05 * (1 + distances / 30)
    final_fares *= traffic_block_impact
    
    # Holiday multiplier
    final_fares *= (1 + is_holiday * 0.2)
    
    # Event multiplier
    final_fares *= (1 + is_event * 0.3)
    
    # Peak hour multiplier (7-9am, 5-7pm)
    hours = [t.hour for t in timestamps]
    is_peak = np.array([1 if 7 <= h <= 9 or 17 <= h <= 19 else 0 for h in hours])
    final_fares *= (1 + is_peak * 0.25)
    
    # Night time multiplier (10pm-6am)
    is_night = np.array([1 if 22 <= h <= 23 or 0 <= h <= 6 else 0 for h in hours])
    final_fares *= (1 + is_night * 0.15)
    
    # Add some random noise
    final_fares *= np.random.normal(1, 0.02, num_samples)  # 2% random variation
    
    # Round to nearest 10 rupees
    final_fares = np.round(final_fares / 10) * 10
    
    # Create DataFrame
    df = pd.DataFrame({
        'distance_km': distances,
        'time_of_day': hours,
        'traffic_level': traffic_levels,
        'weather_condition': weather_conditions,
        'traffic_blocks': traffic_blocks,
        'holiday': is_holiday,
        'event_nearby': is_event,
        'ride_demand_level': ride_demands,
        'fare': final_fares
    })
    
    return df

if __name__ == "__main__":
    # Generate realistic data
    df = generate_realistic_data(10000)
    
    # Save to CSV
    df.to_csv('realistic_taxi_data.csv', index=False)
    print("Generated realistic taxi data with 10,000 samples")
    
    # Print sample data and statistics
    print("\nSample data:")
    print(df.head())
    
    # Print statistics by distance ranges
    print("\nFare statistics by distance range:")
    distance_ranges = [(0, 5), (5, 10), (10, 15), (15, 20), (20, 30)]
    for start, end in distance_ranges:
        mask = (df['distance_km'] >= start) & (df['distance_km'] < end)
        stats = df[mask]['fare'].describe()
        print(f"\n{start}-{end}km trips:")
        print(f"Count: {stats['count']:.0f}")
        print(f"Mean: ₹{stats['mean']:.2f}")
        print(f"Std: ₹{stats['std']:.2f}")
        print(f"Min: ₹{stats['min']:.2f}")
        print(f"Max: ₹{stats['max']:.2f}") 