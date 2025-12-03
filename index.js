const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ------------------ DATABASE CONNECTION (UPDATED FOR RENDER/TIDB) ------------------
const db = mysql.createConnection({
    // Render Environment Variables से मान पढ़ें:
    host: process.env.DATABASE_HOST,     
    user: process.env.DATABASE_USER,     
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    port: process.env.DATABASE_PORT,
    
    // TiDB Cloud के लिए SSL/TLS एन्क्रिप्शन आवश्यक है
    ssl: { 
        rejectUnauthorized: true 
    }
});

db.connect((err) => {
    if (err) {
        // कनेक्शन विफल होने पर प्रोसेस को Exit करें
        console.error("❌ Database connection error:", err.message);
        console.error("DEBUG: Check Render Environment Variables and TiDB IP Access List.");
        process.exit(1);
    } else {
        console.log("✅ TiDB Cloud Connected Successfully!");
    }
});
// ------------------ END OF DATABASE CONNECTION UPDATE ------------------

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
// SIGNUP / SIGNIN APIs - FIXES RETAINED
// ========================

// SIGNUP
app.post("/signup", (req, res) => {
    const { name, email, phone, password, Confirm_Password } = req.body;
    if (password !== Confirm_Password) {
        return res.status(400).json({ message: "Passwords do not match!" });
    }
    // FIX: Column 'gmail' changed to 'email' (Assuming 'singup' table exists)
    const sql = "INSERT INTO singup (name, email, phone, password, Confirm_Password) VALUES (?, ?, ?, ?, ?)";
    db.query(sql, [name, email, phone, password, Confirm_Password], (err, result) => {
        if (err) {
            console.error("Error inserting signup data:", err);
            // Check for duplicate entry error (e.g., duplicate email)
            if (err.code === 'ER_DUP_ENTRY') {
                 return res.status(409).json({ message: "Error: Email or Phone already registered." });
            }
            return res.status(500).json({ message: "Error inserting data", error: err });
        }
        res.json({ message: "Signup successful! Go to SignIn page." });
    });
});

// SIGNIN
app.post("/signin", (req, res) => {
    const { email, password } = req.body;
    // FIX: Column 'gmail' changed to 'email' (Assuming 'singup' table exists)
    const sql = "SELECT * FROM singup WHERE email = ? AND password = ?";
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
// 🟢 USER ORDER APIs (CRUD) - UPDATED FOR CartPage.js
// =====================================

// Add New Order (CREATE) - /api/orders
app.post("/api/orders", (req, res) => { 
    // 🔥 NEW/UPDATED: CartPage.js से भेजे गए 9 फ़ील्ड को प्राप्त करना
    const { 
        product_id, 
        product_name, 
        product_price, 
        product_image_url, 
        product_description,
        user_name, 
        phone_number, 
        address, 
        payment_method 
    } = req.body;

    if (!product_id || !user_name || !address || !product_price) {
        return res.status(400).json({ error: "Missing essential order details." });
    }

    // 🏆 UPDATED SQL Query: सुनिश्चित करें कि यह आपके MySQL 'orders' टेबल से मेल खाता है।
    // Note: यहाँ 'product_url' को 'product_image_url' मान लिया गया है और 'phone' को 'phone_number' मान लिया गया है।
    const sql = `
        INSERT INTO orders (
            product_id, user_name, phone, product_name, product_url, description, price, address, payment_method, order_date
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    // 🏆 UPDATED Values Array: सभी 9 फ़ील्ड को सही क्रम में पास करना
    const values = [
        product_id, 
        user_name, 
        phone_number, 
        product_name, 
        product_image_url, 
        product_description, 
        product_price, 
        address, 
        payment_method
    ];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.log("Order Insert Error:", err);
            return res.status(500).json({ error: "Order Insert Failed", details: err.message });
        }
        res.json({ message: "Order Placed Successfully!", orderId: result.insertId });
    });
});

// Get All Orders (READ) - /api/orders (No Change)
app.get("/api/orders", (req, res) => {
    const sql = "SELECT * FROM orders ORDER BY id DESC"; 

    db.query(sql, (err, result) => {
        if (err) {
            console.log("Error fetching orders:", err);
            return res.status(500).json({ error: "Order Fetch Failed" });
        }
        res.json(result);
    });
});

// ✍️ UPDATE Order by ID (EDIT) - /api/orders/:id (No Change)
app.put("/api/orders/:id", (req, res) => {
    const orderId = req.params.id;
    // Note: Column name 'phone' is used in SQL query
    const { user_name, phone_number, address, payment_method } = req.body; 

    const sql = `
        UPDATE orders 
        SET user_name = ?, phone = ?, address = ?, payment_method = ?
        WHERE id = ?
    `;
    
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

// 🗑️ DELETE Order by ID - /api/orders/:id (No Change)
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
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`📡 Server running on port ${PORT}`);
});
