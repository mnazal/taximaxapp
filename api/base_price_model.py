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

# Preprocess and feature engineering
def preprocess_data(df):
    """Preprocess the data and perform feature engineering."""
    logger.info("Preprocessing data...")
    
    # Fix incomplete row (if needed)
    df = df.dropna()  # Remove rows with missing values

    # Feature engineering
    # Use 'time_of_day' directly as 'hour_of_day'
    df['hour_of_day'] = df['time_of_day']
    
    # Map weather conditions to severity levels
    weather_severity = {'Clear': 0, 'Rainy': 1, 'Snowy': 2, 'Foggy': 3}
    df['weather_severity'] = df['weather_condition'].map(weather_severity)
    
    # Calculate traffic impact
    df['traffic_impact'] = df['traffic_level'] * df['traffic_blocks']
    
    # Drop unnecessary columns
    df = df.drop(['time_of_day', 'weather_condition', 'traffic_blocks'], axis=1)
    
    logger.info("Data preprocessing completed.")
    return df

# Build the model pipeline
def build_model():
    """Build the model pipeline."""
    logger.info("Building the model pipeline...")
    
    numerical_features = ['distance_km', 'traffic_level', 'ride_demand_level', 'traffic_impact', 'weather_severity', 'hour_of_day']
    
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', StandardScaler(), numerical_features)
        ])

    model = Pipeline([
        ('preprocessor', preprocessor),
        ('regressor', RandomForestRegressor(n_estimators=100, random_state=42))  # Use RandomForestRegressor
    ])
    
    logger.info("Model pipeline built.")
    return model

# Train and evaluate the model
def train_and_evaluate(model, X_train, X_test, y_train, y_test):
    """Train and evaluate the model."""
    logger.info("Training the model...")
    model.fit(X_train, y_train)
    
    logger.info("Evaluating the model...")
    y_pred = model.predict(X_test)
    
    rmse = mean_squared_error(y_test, y_pred)  # RMSE
    r2 = r2_score(y_test, y_pred)  # R² Score
    
    print(f"RMSE: {rmse:.2f}")
    print(f"R² Score: {r2:.2f}")
    
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
        df = load_data('taximax_extended_parameters.csv')
        
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