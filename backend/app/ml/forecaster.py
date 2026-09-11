"""ML Demand Forecaster using scikit-learn LinearRegression with EMA fallback."""
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List

import numpy as np

logger = logging.getLogger("shopmind.ml.forecaster")


class DemandForecaster:
    def forecast(self, db, product_id: int, horizon_days: int = 30) -> Dict[str, Any]:
        """Forecast demand for a product over the next horizon_days."""
        from app.repositories import order_repo, inventory_repo, product_repo
        from app.models import OrderItem
        from sqlmodel import select

        product = product_repo.get(db, product_id)
        inv = inventory_repo.get_by_product(db, product_id)
        if not product or not inv:
            raise ValueError(f"Product {product_id} not found")

        # Gather historical order data (last 90 days)
        cutoff = datetime.now(timezone.utc) - timedelta(days=90)
        items = db.exec(
            select(OrderItem).where(OrderItem.product_id == product_id)
        ).all()

        # Aggregate daily sales
        daily_sales: Dict[str, int] = {}
        for item in items:
            from app.repositories import order_repo
            order = order_repo.get(db, item.order_id)
            if order and order.created_at >= cutoff:
                day = order.created_at.strftime("%Y-%m-%d")
                daily_sales[day] = daily_sales.get(day, 0) + item.quantity

        sales_values = list(daily_sales.values())
        n_data_points = len(sales_values)

        if n_data_points >= 14:
            # Use LinearRegression
            try:
                from sklearn.linear_model import LinearRegression
                X = np.arange(n_data_points).reshape(-1, 1)
                y = np.array(sales_values)
                model = LinearRegression()
                model.fit(X, y)
                future_X = np.arange(n_data_points, n_data_points + horizon_days).reshape(-1, 1)
                predictions = model.predict(future_X)
                forecast_total = max(0, float(np.sum(predictions)))
                daily_avg = float(np.mean(predictions))
                method = "LinearRegression"
            except Exception as e:
                logger.warning(f"Linear regression failed: {e}, falling back to EMA")
                n_data_points = 0  # force EMA fallback

        if n_data_points < 14:
            # EMA fallback
            if sales_values:
                alpha = 0.3
                ema = sales_values[0]
                for val in sales_values[1:]:
                    ema = alpha * val + (1 - alpha) * ema
                daily_avg = ema
            elif inv.sales_velocity_30d > 0:
                daily_avg = inv.sales_velocity_30d / 30
            else:
                daily_avg = 1.0
            forecast_total = daily_avg * horizon_days
            method = "ExponentialMovingAverage"

        # Stock adequacy assessment
        days_of_stock = inv.current_stock / daily_avg if daily_avg > 0 else 999
        will_stock_out = days_of_stock < horizon_days
        reorder_needed = inv.current_stock <= inv.reorder_threshold

        return {
            "product_id": product_id,
            "product_name": product.name,
            "sku": product.sku,
            "forecast_horizon_days": horizon_days,
            "forecasted_units": round(forecast_total, 1),
            "daily_average_demand": round(daily_avg, 2),
            "current_stock": inv.current_stock,
            "reorder_threshold": inv.reorder_threshold,
            "days_of_stock_remaining": round(days_of_stock, 1),
            "will_stock_out_in_forecast_period": will_stock_out,
            "recommended_restock_quantity": max(0, round(forecast_total - inv.current_stock + inv.reorder_quantity)) if will_stock_out else 0,
            "forecast_method": method,
            "data_points_used": n_data_points,
            "confidence": "HIGH" if n_data_points >= 30 else "MEDIUM" if n_data_points >= 14 else "LOW",
        }


demand_forecaster = DemandForecaster()
