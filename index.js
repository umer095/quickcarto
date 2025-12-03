const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ------------------ DATABASE CONNECTION ------------------
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "", // agar password hai to yaha likho
    database: "productdb"
});

db.connect((err) => {
    if (err) {
        // Exit process if DB connection fails
        console.error("❌ Database connection error:", err.message);
        process.exit(1); 
    } else {
        console.log("✅ MySQL Connected Successfully!");
    }
});

// ========================
// PRODUCT APIs (Admin) - (No Change)
// ========================

// GET all products
app.get("/products", (req, res) => {
    db.query("SELECT * FROM dashboard", (error, results) => {
        if (error) {
            console.error("Error fetching products:", error);
            return res.status(500).json({ error: "Database fetch error" });
        }
        res.json(results);
    });
});

// ADD product
app.post("/products", (req, res) => {
    const { Product_name, Price, Image, Category, Description } = req.body;
    if (!Product_name || !Price) {
        return res.status(400).json({ message: "Product Name and Price are required!" });
    }
    const sql = `INSERT INTO dashboard (Product_name, Price, Image, Category, Description)
                 VALUES (?, ?, ?, ?, ?)`;
    db.query(sql, [Product_name, Price, Image, Category, Description], (error, result) => {
        if (error) {
            console.error("Error adding product:", error);
            return res.status(500).json({ error: "Database insert error" });
        }
        res.json({ message: "Product Added Successfully!", id: result.insertId });
    });
});

// UPDATE product
app.put("/products/:id", (req, res) => {
    const { id } = req.params;
    const { Product_name, Price, Image, Category, Description } = req.body;
    const sql = `UPDATE dashboard 
                 SET Product_name = ?, Price = ?, Image = ?, Category = ?, Description = ?
                 WHERE id = ?`;
    db.query(sql, [Product_name, Price, Image, Category, Description, id], (error, result) => {
        if (error) {
            console.error("Error updating product:", error);
            return res.status(500).json({ error: "Database update error" });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Product not found" });
        }
        res.json({ message: "Product Updated Successfully!" });
    });
});

// DELETE product
app.delete("/products/:id", (req, res) => {
    const { id } = req.params;
    db.query("DELETE FROM dashboard WHERE id = ?", [id], (error, result) => {
        if (error) {
            console.error("Error deleting product:", error);
            return res.status(500).json({ error: "Database delete error" });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Product not found" });
        }
        res.json({ message: "Product Deleted Successfully!" });
    });
});

// ========================
// SIGNUP / SIGNIN APIs - (No Change)
// ========================

// SIGNUP
app.post("/signup", (req, res) => {
    const { name, email, phone, password, Confirm_Password } = req.body;
    if (password !== Confirm_Password) {
        return res.status(400).json({ message: "Passwords do not match!" });
    }
    const sql = "INSERT INTO singup (name, gmail, phone, password, Confirm_Password) VALUES (?, ?, ?, ?, ?)";
    db.query(sql, [name, email, phone, password, Confirm_Password], (err, result) => {
        if (err) {
            console.error("Error inserting signup data:", err);
            return res.status(500).json({ message: "Error inserting data", error: err });
        }
        res.json({ message: "Signup successful! Go to SignIn page." });
    });
});

// SIGNIN
app.post("/signin", (req, res) => {
    const { email, password } = req.body;
    const sql = "SELECT * FROM singup WHERE gmail = ? AND password = ?";
    db.query(sql, [email, password], (err, result) => {
        if (err) {
            console.error("Signin error:", err);
            return res.status(500).json({ message: "Login Error", error: err });
        }

        if (result.length > 0) {
            res.json({
                message: "Login Successful! Redirecting to Admin Page",
                admin: result[0]
            });
        } else {
            res.status(400).json({ message: "Invalid email or password" });
        }
    });
});

// =====================================
// 🟢 USER ORDER APIs (CRUD) - UPDATED
// =====================================

// Add New Order (CREATE) - /api/orders
app.post("/api/orders", (req, res) => { 
    const { user_name, phone_number, product_name, product_image_url, product_description, product_price, address, payment_method } = req.body;

    // 🔥 IMPROVEMENT: Column names adjusted for consistency with common MySQL practices (using phone and price)
    // You must ensure your 'orders' table has these exact columns:
    // user_name, phone, product_name, product_url, description, price, address, payment_method
    const sql = `
        INSERT INTO orders (user_name, phone, product_name, product_url, description, price, address, payment_method)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [user_name, phone_number, product_name, product_image_url, product_description, product_price, address, payment_method], (err, result) => {
        if (err) {
            console.log("Order Insert Error:", err);
            // Log the request body and SQL for better debugging
            // console.log("Request Body:", req.body);
            return res.status(500).json({ error: "Order Insert Failed", details: err.message });
        }
        res.json({ message: "Order Saved Successfully!", orderId: result.insertId });
    });
});

// Get All Orders (READ) - /api/orders
app.get("/api/orders", (req, res) => {
    // Note: If your table has a 'created_at' column, you can order by that.
    const sql = "SELECT * FROM orders ORDER BY id DESC"; 

    db.query(sql, (err, result) => {
        if (err) {
            console.log("Error fetching orders:", err);
            return res.status(500).json({ error: "Order Fetch Failed" });
        }
        res.json(result);
    });
});

// ✍️ UPDATE Order by ID (EDIT) - /api/orders/:id
app.put("/api/orders/:id", (req, res) => {
    const orderId = req.params.id;
    // We only update customer details from the OrderPage's EditForm.
    // Ensure the column names used in SQL match your MySQL table.
    const { user_name, phone_number, address, payment_method } = req.body; 

    // 🔥 IMPROVEMENT: Focusing only on Customer/Shipping details update as that is what the frontend EditForm handles.
    const sql = `
        UPDATE orders 
        SET user_name = ?, phone = ?, address = ?, payment_method = ?
        WHERE id = ?
    `;
    
    // We are passing phone_number to the 'phone' column in MySQL
    db.query(sql, [user_name, phone_number, address, payment_method, orderId], (err, result) => {
        if (err) {
            console.error("Update Order Error:", err);
            return res.status(500).json({ error: "Order Update Failed" });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Order not found." });
        }
        res.json({ message: `Order ID ${orderId} updated successfully.` });
    });
});

// 🗑️ DELETE Order by ID - /api/orders/:id
app.delete("/api/orders/:id", (req, res) => {
    const orderId = req.params.id;
    const sql = "DELETE FROM orders WHERE id = ?";

    db.query(sql, [orderId], (err, result) => {
        if (err) {
            console.error("Delete Order Error:", err);
            return res.status(500).json({ error: "Order Delete Failed" });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Order not found." });
        }
        res.json({ message: `Order ID ${orderId} deleted successfully.` });
    });
});


// ========================
// SERVER START
// ========================
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`📡 Server running on port ${PORT}`);
});