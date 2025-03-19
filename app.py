from flask import Flask, render_template, request, send_file, jsonify
import pandas as pd
import pickle
import os

app = Flask(__name__)
app.config["DEBUG"] = True

# Function to save the production schedule as "model.pkl"
def save_schedule_to_pickle(df):
    save_file = os.path.join(os.getcwd(), "model.pkl")  # Save in the current working directory
    with open(save_file, 'wb') as f:
        pickle.dump(df, f)
    print(f"Production schedule saved as model.pkl in {os.getcwd()}")

# Function to load the production schedule from "model.pkl"
def load_schedule_from_pickle():
    load_file = os.path.join(os.getcwd(), "model.pkl")
    if os.path.exists(load_file):
        with open(load_file, 'rb') as f:
            loaded_df = pickle.load(f)
        print("Pickle file 'model.pkl' loaded successfully!")
        return loaded_df
    else:
        print("Error: model.pkl not found!")
        return None

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/upload", methods=["POST"])
def upload():
    try:
        print("Entered the upload route")
        # Debugging: check if files exist in the request
        if 'Orders' not in request.files or 'Inventory' not in request.files or 'SFC' not in request.files:
            print("Missing one or more files in the request")
            return jsonify({"error": "One or more files are missing."}), 400
        
        # Get the uploaded files from the request
        orders_file = request.files['Orders']
        inventory_file = request.files['Inventory']
        sales_forecast_file = request.files['SFC']
        print("Files uploaded:", orders_file.filename, inventory_file.filename, sales_forecast_file.filename)

        # Read CSV files into DataFrames
        orders_df = pd.read_csv(orders_file)
        inventory_df = pd.read_csv(inventory_file)
        sales_forecast_df = pd.read_csv(sales_forecast_file)
        print("Files read")

        # Process the data to generate the production schedule
        final_schedule_df = process_data(orders_df, inventory_df, sales_forecast_df)
        print("Data processed")

        # Save the schedule to pickle
        save_schedule_to_pickle(final_schedule_df)

        # Generate dummy JSON response for production details
        inventory_level = len(inventory_df) * 10
        pending_orders = len(orders_df) * 5
        sales_forecast = len(sales_forecast_df) * 3

        production_schedule = []
        for i in range(1, 7):
            production_schedule.append({
                "period": f"Month {i}",
                "production_volume": i * 100,
                "inventory_level": inventory_level - (i * 10),
                "order_fulfillment": pending_orders - (i * 5),
                "capacity_utilization": 80 + i,
                "status": "In Progress"
            })

        return jsonify({
            "inventory_level": inventory_level,
            "pending_orders": pending_orders,
            "sales_forecast": sales_forecast,
            "schedule": production_schedule
        })

    except Exception as e:
        print("Error:", str(e))  # Print the error message for debugging
        return jsonify({"error": str(e)}), 500


@app.route("/download")
def download():
    return send_file("production_schedule.csv", as_attachment=True)

@app.route("/load_schedule", methods=["GET"])
def load_schedule():
    loaded_df = load_schedule_from_pickle()
    if loaded_df is not None:
        return loaded_df.to_json(orient="records")  # Return JSON response with the loaded schedule
    else:
        return jsonify({"error": "No schedule found."}), 404

def process_data(orders_df, inventory_df, sales_forecast_df):
    """Your function to process CSV data and generate the schedule"""
    inventory_level = len(inventory_df) * 10
    pending_orders = len(orders_df) * 5
    sales_forecast = len(sales_forecast_df) * 3

    production_schedule = []
    for i in range(1, 7):
        production_schedule.append({
            "period": f"Month {i}",
            "production_volume": i * 100,
            "inventory_level": inventory_level - (i * 10),
            "order_fulfillment": pending_orders - (i * 5),
            "capacity_utilization": 80 + i,
            "status": "In Progress"
        })

    schedule_df = pd.DataFrame(production_schedule)
    return schedule_df

if __name__ == "__main__":
    app.run(debug=True)
