const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const mysql = require('mysql2');
const port = 4001;

app.use(bodyParser.json());


//database connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'admin',
  password: 'admin123',
  database: 'Store'
});

db.connect((err) => {
    if (err) {
      console.error('Error connecting to database: ' + err.stack);
      return;
    }
    else{
      console.log(`Connected to database`)
    }
  })
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////






  //Customers
  app.get('/all-customers', (req,res) => {
    const sql = "SELECT * FROM customers";

    db.query(sql, (err, result) => {
        if(err){
            res.send("There are no existing Customers")
        }else{
            res.send({
                message: "Here are all the Customers",
                data: result
            })
        }
    })
  })
//ADD CUSTOMERS
  app.post('/add-customers', (req, res) => {
    const { first_name ,last_name ,email ,phone ,address } = req.body;
    const sql = `INSERT INTO customers (first_name ,last_name ,email ,phone ,address) VALUES ('${first_name}', '${last_name}', '${email}', '${phone}', '${address}')`;
    db.query(sql, [first_name ,last_name ,email ,phone ,address], (err, result) => {
      if(err){
        res.send("There was an error adding a Customer")
      }else{
        res.send("Customer added successfully")
      }
    })
  })

//UPDATE CUSTOMERS
app.put('/update-customer/:customer_id', (req, res) => {
    const { first_name, last_name, email, phone, address} = req.body;
    const { customer_id } = req.params;

    const sql = "UPDATE customers SET first_name = ?, last_name = ?, email = ?, phone = ?, address = ? WHERE customer_id = ?";

    db.query(sql, [first_name, last_name, email, phone, address, customer_id], (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send("There was an error updating the customer");
        } else {
            res.send({
                message: "Successfully updated the customer",
                data: results,
            });
        }
    });
});

//DELETE Customer
app.delete('/delete-customer/:customer_id', (req, res) => {
    const { customer_id } = req.params;
    const sql = "delete from customers WHERE customer_id = ?";

    db.query(sql, [customer_id], (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send("There was an error with the given ID");
        } else {
            res.send({
                message: "Successfully removing a Customer",
                data: results,
            });
        }
    });
})
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////







  //ORDERS
//GET ORDERS
app.get('/all-orders', (req,res) => {
    const sql = "SELECT * FROM orders";

    db.query(sql, (err, result) => {
        if(err){
            res.send("There are no existing orders")
        }else{
            res.send({
                message: "Here are all the orders",
                data: result
            })
        }
    })
  })

//ORDERING
  app.post('/ordering', (req, res) => {
    const { customer_id, product_id, total_amount } = req.body;

    const insertOrderSQL = `
        INSERT INTO orders (customer_id, product_id, total_amount )
        VALUES ('${customer_id}', '${product_id}', '${total_amount}')
    `;

    const updateStockSQL = `
        UPDATE products
        SET stock_quantity = stock_quantity - 1
        WHERE product_id = ? AND stock_quantity > 0
    `;

    db.beginTransaction(err => {
        if (err) return res.status(500).json({ error: "Transaction error" });

        // Insert the order
        db.query(insertOrderSQL, [customer_id, product_id, total_amount], (err, result) => {
            if (err) {
                return db.rollback(() => {
                    res.status(500).json({ error: "Failed to insert order" });
                });
            }

            // Update the stock
            db.query(updateStockSQL, [product_id], (err, result) => {
                if (err || result.affectedRows === 0) {
                    return db.rollback(() => {
                        res.status(400).json({ error: "Product out of stock or error updating stock" });
                    });
                }

                db.commit(err => {
                    if (err) {
                        return db.rollback(() => {
                            res.status(500).json({ error: "Transaction commit error" });
                        });
                    }

                    res.status(201).json({ message: "Order placed and stock updated successfully" });
                });
            });
        });
    });
});

// Get order details
app.get('/orders/:order_id', (req, res) => {
    const { order_id } = req.params;

    const query = 'SELECT order_id,customer_id, order_date, status, products.product_id, products.name, products.category, products.price FROM orders INNER JOIN products WHERE order_id = ?';
    db.query(query, [order_id], (err, rows) => {
        if (err) {
            res.status(500).send('Error fetching order data: ' + err.message);
            return;
        }
        if (rows.length === 0) {
            res.status(404).send('Order not found');
            return;
        }
        res.status(200).json(rows[0]);
    });
});
//Order Remove
app.delete('/delete-order/:order_id', (req, res) => {
    const { order_id } = req.params;
    const sql = "delete from orders WHERE order_id = ?";

    db.query(sql, [order_id], (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send("There was an error with the given ID");
        } else {
            res.send({
                message: "Successfully removing a Order",
                data: results,
            });
        }
    });
});

//UPDATE orders
app.put('/update-order/:order_id', (req, res) => {
    const {  status, total_amount} = req.body;
    const { order_id } = req.params;

    const sql = "UPDATE orders SET status = ?, total_amount = ? WHERE order_id = ?";

    db.query(sql, [status, total_amount, order_id], (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send("There was an error updating the order");
        } else {
            res.send({
                message: "Successfully updated the Order",
                data: results,
            });
        }
    });
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////





// PAYMENT
//CREATE PAYMENT
app.post('/payment', (req, res) => {
    const { order_id, amount, customer_change } = req.body;

    const selectPayment = `
    Select status FROM orders WHERE order_id = ?`

    const insertPaymentSQL = `
        INSERT INTO payment (order_id, amount, customer_change)
        VALUES ('${order_id}', '${amount}', '${customer_change}')
    `;

    const updateStatusSQL = `
        UPDATE orders
        SET status =  "completed"
        WHERE order_id = ? 
    `;

    db.beginTransaction(err => {
        if (err) return res.status(500).json({ error: "Transaction error" });

        db.query(selectPayment, [order_id], (err, result)=> {
            console.log(result[0].status);
            if (result[0].status === "completed"){
                res.json("Order status is already completed.")
            }

            else{
                db.query(insertPaymentSQL, [order_id, amount, customer_change], (err, result) => {
                    if (err) {
                        return db.rollback(() => {
                            res.status(500).json({ error: "Failed to add payment" });
                        });
                    }
        
                    // Update the STATUS
                    db.query(updateStatusSQL, [order_id], (err, result) => {
                        if (err || result.affectedRows === 0) {
                            return db.rollback(() => {
                                res.status(400).json({ error: "Status Update Failed" });
                            });
                        }
        
                        db.commit(err => {
                            if (err) {
                                return db.rollback(() => {
                                    res.status(500).json({ error: "Transaction commit error" });
                                });
                            }
        
                            res.status(201).json({ message: "Order placed and status updated successfully" });
                        });
                    });
                });
            }
        })
        
       
    });
});

//GET PAYMENT
app.get('/all-payment', (req,res) => {
    const sql = "SELECT * FROM payment";

    db.query(sql, (err, result) => {
        if(err){
            res.send("There are no existing Payment-now")
        }else{
            res.send({
                message: "Here are all the Pending-Payment",
                data: result
            });
        };
    });
  });

//DELETE Customer
app.delete('/delete-payment/:payment_id', (req, res) => {
    const { payment_id } = req.params;
    const sql = "delete from payment WHERE payment_id = ?";

    db.query(sql, [payment_id], (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send("There was an error with the given ID");
        } else {
            res.send({
                message: "Successfully removing a Payment",
                data: results,
            });
        }
    });
})

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  





//PRODUCTS SHOW
  app.get('/all-products', (req,res) => {
    const sql = "SELECT * FROM products";

    db.query(sql, (err, result) => {
        if(err){
            res.send("There are no existing Products")
        }else{
            res.send({
                message: "Here are the Products",
                data: result
            })
        }
    })
  })

//ADD PRODUCTS
  app.post('/add-products', (req, res) => {
    const { name, category ,price ,stock_quantity } = req.body;
    const sql = `INSERT INTO products (name , category ,price ,stock_quantity) VALUES ('${name}', '${category}', '${price}', '${stock_quantity}')`;
    db.query(sql, [name , category ,price ,stock_quantity], (err, result) => {
      if(err){
        res.send("There was an error adding a product/s")
      }else{
        res.send("Product/s added successfully")
      }
    })
  })
//UPDATE PRICE
  app.put('/update-price/:product_id', (req, res) => {
    const { price } = req.body;
    const { product_id } = req.params;

    // Use parameterized query to avoid SQL injection and syntax issues
    const sql = "UPDATE products SET price = ? WHERE product_id = ?";

    db.query(sql, [price, product_id], (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send("There was an error updating the price");
        } else {
            res.send({
                message: "Successfully updated the price",
                data: results,
            });
        }
    });
});
//UPDATE STOCKS
app.put('/update-stocks/:product_id', (req, res) => {
    const { stock_quantity } = req.body;
    const { product_id } = req.params;

    // Use parameterized query to avoid SQL injection and syntax issues
    const sql = "UPDATE products SET stock_quantity = stock_quantity + ? WHERE product_id = ?";

    db.query(sql, [stock_quantity, product_id], (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send("There was an error updating the stock");
        } else {
            res.send({
                message: "Successfully updating the stocks",
                data: results,
            });
        }
    });
});
//DELETE PRODUCTS
app.delete('/delete/:product_id', (req, res) => {
    const { product_id } = req.params;
    const sql = "delete from products WHERE product_id = ?";

    db.query(sql, [product_id], (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send("There was an error with the given ID");
        } else {
            res.send({
                message: "Successfully removing a Product",
                data: results,
            });
        }
    });
});



  app.listen(port, () => console.log(`Server is running on port ${port}`))