# Import libraries
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, r2_score
import joblib  # For saving the model
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load the dataset
def load_data(filepath):
    """Load the dataset from a CSV file."""
    logger.info(f"Loading data from {filepath}")
    df = pd.read_csv(filepath)
    return df

def clean_data(df):
    """Clean the data by removing outliers and unrealistic values."""
    logger.info("Cleaning data...")
    
    # Remove rows with unrealistic distances
    df = df[df['distance_km'] > 0]
    df = df[df['distance_km'] <= 30]  # Maximum reasonable distance
    
    # Calculate reasonable fare range based on distance (in rupees)
    min_fare = 30 + (df['distance_km'] * 7)  # Base fare ₹30 + minimum ₹7 per km
    max_fare = 30 + (df['distance_km'] * 10)  # Base fare ₹30 + maximum ₹10 per km
    
    # Remove rows with unrealistic fares
    df = df[(df['fare'] >= min_fare) & (df['fare'] <= max_fare)]
    
    return df

def preprocess_data(df):
    """Preprocess the data and perform feature engineering."""
    logger.info("Preprocessing data...")
    
    # Clean the data first
    df = clean_data(df)
    
    # Feature engineering
    df['hour_of_day'] = df['time_of_day']
    
    # Map weather conditions to severity levels
    weather_severity = {'Clear': 0, 'Rainy': 1, 'Foggy': 2, 'Snowy': 3}
    df['weather_severity'] = df['weather_condition'].map(weather_severity)
    
    # Calculate traffic impact
    df['traffic_impact'] = df['traffic_level'] * df['traffic_blocks']
    
    # Add time-based features
    df['is_peak_hour'] = df['hour_of_day'].apply(lambda x: 1 if x in [7,8,9,17,18,19] else 0)
    df['is_night'] = df['hour_of_day'].apply(lambda x: 1 if x in list(range(22,24)) + list(range(0,6)) else 0)
    
    # Add distance-based features
    df['distance_squared'] = df['distance_km'] ** 2
    df['log_distance'] = np.log1p(df['distance_km'])
    
    # Add special event features
    df['special_conditions'] = df['holiday'] + df['event_nearby']
    
    # Drop unnecessary columns
    df = df.drop(['time_of_day', 'weather_condition', 'traffic_blocks', 'holiday', 'event_nearby'], axis=1)
    
    logger.info("Data preprocessing completed.")
    return df

# Build the model pipeline
def build_model():
    """Build the model pipeline."""
    logger.info("Building the model pipeline...")
    
    numerical_features = [
        'distance_km', 'traffic_level', 'ride_demand_level', 
        'traffic_impact', 'weather_severity', 'hour_of_day',
        'is_peak_hour', 'is_night', 'distance_squared', 'log_distance',
        'special_conditions'
    ]
    
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', StandardScaler(), numerical_features)
        ])

    model = Pipeline([
        ('preprocessor', preprocessor),
        ('regressor', RandomForestRegressor(
            n_estimators=200,
            max_depth=15,  # Increased depth for better distance relationships
            min_samples_leaf=3,  # Reduced for more granular predictions
            min_samples_split=5,  # Added to prevent overfitting
            random_state=42
        ))
    ])
    
    logger.info("Model pipeline built.")
    return model

# Train and evaluate the model
def train_and_evaluate(model, X_train, X_test, y_train, y_test):
    """Train and evaluate the model."""
    logger.info("Training the model...")
    
    # Add sample weights to emphasize distance relationship
    sample_weights = np.sqrt(X_train['distance_km'])  # More weight to longer distances
    model.fit(X_train, y_train, regressor__sample_weight=sample_weights)
    
    logger.info("Evaluating the model...")
    y_pred = model.predict(X_test)
    
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)
    
    print(f"RMSE: {rmse:.2f} rupees")
    print(f"R² Score: {r2:.2f}")
    
    # Print feature importance
    feature_names = X_train.columns
    importances = model.named_steps['regressor'].feature_importances_
    feature_importance = pd.DataFrame({
        'feature': feature_names,
        'importance': importances
    }).sort_values('importance', ascending=False)
    
    print("\nFeature Importance:")
    print(feature_importance)
    
    # Print distance-based predictions
    test_distances = np.array([2, 5, 10, 15])
    test_data = pd.DataFrame({
        'distance_km': test_distances,
        'traffic_level': [2] * len(test_distances),
        'ride_demand_level': [3] * len(test_distances),
        'traffic_impact': [2] * len(test_distances),
        'weather_severity': [0] * len(test_distances),
        'hour_of_day': [12] * len(test_distances),
        'is_peak_hour': [0] * len(test_distances),
        'is_night': [0] * len(test_distances),
        'distance_squared': test_distances ** 2,
        'log_distance': np.log1p(test_distances),
        'special_conditions': [0] * len(test_distances)
    })
    test_predictions = model.predict(test_data)
    print("\nDistance-based predictions:")
    for dist, pred in zip(test_distances, test_predictions):
        print(f"{dist}km: ₹{pred:.2f}")
    
    logger.info("Model training and evaluation completed.")
    return model

# Save the model
def save_model(model, filename):
    """Save the trained model to a file."""
    logger.info(f"Saving the model as {filename}...")
    joblib.dump(model, filename)
    logger.info(f"Model saved as {filename}")

# Main function
def main():
    """Main function to execute the pipeline."""
    try:
        # Load data
        df = load_data('../realistic_taxi_data.csv')
        
        # Preprocess
        df = preprocess_data(df)
        
        # Split data
        X = df.drop('fare', axis=1)
        y = df['fare']
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # Build and train model
        model = build_model()
        trained_model = train_and_evaluate(model, X_train, X_test, y_train, y_test)
        
        # Save the model
        save_model(trained_model, "dynamic_pricing_model.joblib")
    
    except Exception as e:
        logger.error(f"An error occurred: {e}")

if __name__ == "__main__":
    main()