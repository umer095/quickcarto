const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ------------------ DATABASE CONNECTION (POOL) ------------------
// 🔥 FIX 1: Connection Pool का उपयोग ताकि Render पर कनेक्शन बंद न हो
const db = mysql.createPool({ 
    host: process.env.DATABASE_HOST,      
    user: process.env.DATABASE_USER,      
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME, // Assuming this is 'productdb'
    port: process.env.DATABASE_PORT,
    ssl: {  
        rejectUnauthorized: true  
    },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function testDbConnection() {
    try {
        await db.getConnection();
        console.log("✅ TiDB Cloud Pool Connected Successfully!");
    } catch (err) {
        console.error("❌ Database pool error (FATAL):", err.message);
        console.error("DEBUG: Check Environment Variables and TiDB IP Access List.");
        process.exit(1);
    }
}
testDbConnection();
// ------------------ END OF DATABASE CONNECTION UPDATE ------------------

// ========================
// PRODUCT APIs (dashboard table) - All async/await
// ========================

// GET all products
app.get("/products", async (req, res) => {
    try {
        const [results] = await db.query("SELECT * FROM dashboard"); 
        res.json(results);
    } catch (error) {
        console.error("Error fetching products:", error);
        return res.status(500).json({ error: "Database fetch error" });
    }
});

// ADD product
app.post("/products", async (req, res) => {
    const { Product_name, Price, Image, Category, Description } = req.body;
    if (!Product_name || !Price) {
        return res.status(400).json({ message: "Product Name and Price are required!" });
    }
    const sql = `INSERT INTO dashboard (Product_name, Price, Image, Category, Description)
                 VALUES (?, ?, ?, ?, ?)`;
    try {
        const [result] = await db.query(sql, [Product_name, Price, Image, Category, Description]);
        res.json({ message: "Product Added Successfully!", id: result.insertId });
    } catch (error) {
        console.error("Error adding product:", error);
        return res.status(500).json({ error: "Database insert error" });
    }
});

// UPDATE product
app.put("/products/:id", async (req, res) => {
    const { id } = req.params;
    const { Product_name, Price, Image, Category, Description } = req.body;
    const sql = `UPDATE dashboard SET Product_name = ?, Price = ?, Image = ?, Category = ?, Description = ? WHERE id = ?`;
    try {
        const [result] = await db.query(sql, [Product_name, Price, Image, Category, Description, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Product not found" });
        }
        res.json({ message: "Product Updated Successfully!" });
    } catch (error) {
        console.error("Error updating product:", error);
        return res.status(500).json({ error: "Database update error" });
    }
});

// DELETE product
app.delete("/products/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.query("DELETE FROM dashboard WHERE id = ?", [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Product not found" });
        }
        res.json({ message: "Product Deleted Successfully!" });
    } catch (error) {
        console.error("Error deleting product:", error);
        return res.status(500).json({ error: "Database delete error" });
    }
});

// ========================
// SIGNUP / SIGNIN APIs (singup table)
// ========================

// SIGNUP
app.post("/signup", async (req, res) => {
    const { name, email, phone, password, Confirm_Password } = req.body;
    if (password !== Confirm_Password) {
        return res.status(400).json({ message: "Passwords do not match!" });
    }
    // 🔥 FIX 2: Table name is 'singup' and column is 'gmail' as per your original SQL dump
    const sql = "INSERT INTO singup (name, gmail, phone, password, Confirm_Password) VALUES (?, ?, ?, ?, ?)";
    
    try {
        const [result] = await db.query(sql, [name, email, phone, password, Confirm_Password]); 
        res.json({ message: "Signup successful! Go to SignIn page." });
    } catch (err) {
        console.error("Error inserting signup data:", err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: "Error: Email or Phone already registered." });
        }
        return res.status(500).json({ message: "Error inserting data", error: err });
    }
});

// SIGNIN
app.post("/signin", async (req, res) => {
    const { email, password } = req.body;
    // 🔥 FIX 3: Table name is 'singup' and column is 'gmail' as per your original SQL dump
    const sql = "SELECT * FROM singup WHERE gmail = ? AND password = ?";
    
    try {
        const [result] = await db.query(sql, [email, password]); 
        
        if (result.length > 0) {
            // Note: If you stored other details in the database, they will be in result[0]
            res.json({
                message: "Login Successful! Redirecting to Admin Page",
                admin: result[0]
            });
        } else {
            res.status(400).json({ message: "Invalid email or password" });
        }
    } catch (err) {
        console.error("Signin error:", err);
        return res.status(500).json({ message: "Login Error", error: err });
    }
});

// =====================================
// 🟢 USER ORDER APIs (orders table)
// =====================================

// Add New Order (CREATE) - /api/orders
app.post("/api/orders", async (req, res) => {
    const { product_id, product_name, product_price, product_image_url, product_description,
        user_name, phone_number, address, payment_method } = req.body;

    if (!product_id || !user_name || !address || !product_price) {
        return res.status(400).json({ error: "Missing essential order details." });
    }

    const sql = `
        INSERT INTO orders (
            product_id, user_name, phone, product_name, product_url, description, price, address, payment_method, order_date
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    // Values map to: (product_id, user_name, phone, product_name, product_url, description, price, address, payment_method)
    const values = [product_id, user_name, phone_number, product_name, product_image_url, product_description, product_price, address, payment_method];

    try {
        const [result] = await db.query(sql, values);
        res.json({ message: "Order Placed Successfully!", orderId: result.insertId });
    } catch (err) {
        console.log("Order Insert Error:", err);
        return res.status(500).json({ error: "Order Insert Failed", details: err.message });
    }
});

// Get All Orders (READ) - /api/orders
app.get("/api/orders", async (req, res) => {
    const sql = "SELECT * FROM orders ORDER BY id DESC";
    try {
        const [result] = await db.query(sql);
        res.json(result);
    } catch (err) {
        console.log("Error fetching orders:", err);
        return res.status(500).json({ error: "Order Fetch Failed" });
    }
});

// ✍️ UPDATE Order by ID (EDIT) - /api/orders/:id
app.put("/api/orders/:id", async (req, res) => {
    const orderId = req.params.id;
    const { user_name, phone_number, address, payment_method } = req.body;

    const sql = `
        UPDATE orders SET user_name = ?, phone = ?, address = ?, payment_method = ?
        WHERE id = ?
    `;
    
    try {
        const [result] = await db.query(sql, [user_name, phone_number, address, payment_method, orderId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Order not found." });
        }
        res.json({ message: `Order ID ${orderId} updated successfully.` });
    } catch (err) {
        console.error("Update Order Error:", err);
        return res.status(500).json({ error: "Order Update Failed" });
    }
});

// 🗑️ DELETE Order by ID - /api/orders/:id
app.delete("/api/orders/:id", async (req, res) => {
    const orderId = req.params.id;
    const sql = "DELETE FROM orders WHERE id = ?";

    try {
        const [result] = await db.query(sql, [orderId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Order not found." });
        }
        res.json({ message: `Order ID ${orderId} deleted successfully.` });
    } catch (err) {
        console.error("Delete Order Error:", err);
        return res.status(500).json({ error: "Order Delete Failed" });
    }
});


// ========================
// SERVER START
// ========================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`📡 Server running on port ${PORT}`);
});
