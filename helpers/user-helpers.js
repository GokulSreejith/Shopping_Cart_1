var db = require("../config/connection");
var collection = require("../config/collections");
const bcrypt = require("bcrypt");
const { response } = require("express");
const { ObjectID } = require("mongodb");
const { reject } = require("promise");
const { pipeline } = require("stream");
const collections = require("../config/collections");
const { resolve } = require("path");
var objectId = require("mongodb").ObjectID;
const Razorpay = require("razorpay");
require("dotenv").config();
var instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

module.exports = {
    doSignup: (userData) => {
        return new Promise(async (resolve, reject) => {
            let user = await db
                .get()
                .collection(collection.USER_COLLECTION)
                .findOne({ Email: userData.Email });
            if (user) {
                console.log("Already have a account");
                resolve({ status: false });
            } else {
                userData.Password = await bcrypt.hash(userData.Password, 10);
                console.log(userData);
                db.get()
                    .collection(collection.USER_COLLECTION)
                    .insertOne(userData)
                    .then((data) => {
                        resolve(data.ops[0]);
                    });
            }
        });
    },
    doLogin: (userData) => {
        return new Promise(async (resolve, reject) => {
            let loginStatus = false;
            let response = {};
            let user = await db
                .get()
                .collection(collection.USER_COLLECTION)
                .findOne({ Email: userData.Email });
            if (user) {
                bcrypt.compare(userData.Password, user.Password).then((status) => {
                    if (status) {
                        console.log("Login Success");
                        response.user = user;
                        response.status = true;
                        resolve(response);
                    } else {
                        console.log("log failed");
                        resolve({ status: false });
                    }
                });
            } else {
                console.log("login failed");
                resolve({ status: false });
            }
        });
    },
    getUserDetails: (userId) => {
        return new Promise((resolve, reject) => {
            db.get()
                .collection(collection.USER_COLLECTION)
                .findOne({ _id: objectId(userId) })
                .then((userDetails) => {
                    resolve(userDetails);
                });
        });
    },
    getFeaturedProducts: () => {
        return new Promise(async (resolve, reject) => {
            let featuredProds = await db
                .get()
                .collection(collection.PRODUCT_COLLECTION)
                .find({ Category: "Featured Products" })
                .toArray();
            resolve(featuredProds);
        });
    },
    getSpecialProducts: () => {
        return new Promise(async (resolve, reject) => {
            let specialProds = await db
                .get()
                .collection(collection.PRODUCT_COLLECTION)
                .find({ Category: "Special Products" })
                .toArray();
            resolve(specialProds);
        });
    },
    getTrendingProducts: () => {
        return new Promise(async (resolve, reject) => {
            let trendingProds = await db
                .get()
                .collection(collection.PRODUCT_COLLECTION)
                .find({ Category: "Trending Products" })
                .toArray();
            resolve(trendingProds);
        });
    },
    getAllNews:()=>{
        return new Promise(async (resolve, reject) => {
            let news = await db
                .get()
                .collection(collection.NEWS_COLLECTION)
                .find()
                .toArray();
            resolve(news);
        });
    },
    getProductView: (proId) => {
        return new Promise((resolve, reject) => {
            db.get()
                .collection(collection.PRODUCT_COLLECTION)
                .findOne({ _id: objectId(proId) })
                .then((proDetails) => {
                    resolve(proDetails);
                });
        });
    },
    editProfile: (userId, usrDetails) => {
        return new Promise((resolve, reject) => {
            db.get()
                .collection(collection.USER_COLLECTION)
                .updateOne(
                    { _id: objectId(userId) },
                    {
                        $set: {
                            Name: usrDetails.Name,
                            Age: parseInt(usrDetails.Age),
                            Gender: usrDetails.Gender,
                            Email: usrDetails.Email,
                            Mobile: parseInt(usrDetails.Mobile),
                        },
                    }
                )
                .then((response) => {
                    resolve();
                });
        });
    },
    addToCart: (proId, userId) => {
        let proObj = {
            item: objectId(proId),
            quantity: 1,
        };
        return new Promise(async (resolve, reject) => {
            let userCart = await db
                .get()
                .collection(collection.CART_COLLECTION)
                .findOne({ user: objectId(userId) });
            if (userCart) {
                let proExist = userCart.products.findIndex(
                    (product) => product.item == proId
                );
                if (proExist !== -1) {
                    db.get()
                        .collection(collection.CART_COLLECTION)
                        .updateOne(
                            { user: objectId(userId), "products.item": objectId(proId) },
                            {
                                $inc: { "products.$.quantity": 1 },
                            }
                        )
                        .then(() => {
                            resolve();
                        });
                } else {
                    db.get()
                        .collection(collection.CART_COLLECTION)
                        .updateOne(
                            { user: objectId(userId) },
                            {
                                $push: { products: proObj },
                            }
                        )
                        .then((response) => {
                            resolve();
                        });
                }
            } else {
                let cartObj = {
                    user: objectId(userId),
                    products: [proObj],
                };
                db.get()
                    .collection(collection.CART_COLLECTION)
                    .insertOne(cartObj)
                    .then((response) => {
                        resolve();
                    });
            }
        });
    },
    getCartProducts: (userId, proId) => {
        return new Promise(async (resolve, reject) => {
            let cartItems = await db
                .get()
                .collection(collection.CART_COLLECTION)
                .aggregate([
                    {
                        $match: { user: objectId(userId) },
                    },
                    {
                        $unwind: "$products",
                    },
                    {
                        $project: {
                            item: "$products.item",
                            quantity: "$products.quantity",
                        },
                    },
                    {
                        $lookup: {
                            from: collection.PRODUCT_COLLECTION,
                            localField: "item",
                            foreignField: "_id",
                            as: "product",
                        },
                    },
                    {
                        $project: {
                            item: 1,
                            quantity: 1,
                            product: { $arrayElemAt: ["$product", 0] },
                        },
                    },
                ])
                .toArray();
            resolve(cartItems);
        });
    },
    getCartCount: (userId) => {
        return new Promise(async (resolve, reject) => {
            count = 0;
            let cart = await db
                .get()
                .collection(collection.CART_COLLECTION)
                .findOne({ user: objectId(userId) });
            if (cart) {
                count = cart.products.length;
            }
            resolve(count);
        });
    },
    changeProductQuantity: (details) => {
        details.count = parseInt(details.count);
        details.quantity = parseInt(details.quantity);

        return new Promise((resolve, reject) => {
            if (details.count == -1 && details.quantity == 1) {
                db.get()
                    .collection(collection.CART_COLLECTION)
                    .updateOne(
                        { _id: objectId(details.cart) },
                        {
                            $pull: { products: { item: objectId(details.product) } },
                        }
                    )
                    .then((response) => {
                        resolve({ removeProduct: true });
                    });
            } else {
                db.get()
                    .collection(collection.CART_COLLECTION)
                    .updateOne(
                        {
                            _id: objectId(details.cart),
                            "products.item": objectId(details.product),
                        },
                        {
                            $inc: { "products.$.quantity": details.count },
                        }
                    )
                    .then((response) => {
                        resolve({ status: true });
                    });
            }
        });
    },
    getTotalAmount: (userId) => {
        return new Promise(async (resolve, reject) => {
            let total = await db
                .get()
                .collection(collection.CART_COLLECTION)
                .aggregate([
                    {
                        $match: { user: objectId(userId) },
                    },
                    {
                        $unwind: "$products",
                    },
                    {
                        $project: {
                            item: "$products.item",
                            quantity: "$products.quantity",
                        },
                    },
                    {
                        $lookup: {
                            from: collection.PRODUCT_COLLECTION,
                            localField: "item",
                            foreignField: "_id",
                            as: "product",
                        },
                    },
                    {
                        $project: {
                            item: 1,
                            quantity: 1,
                            product: { $arrayElemAt: ["$product", 0] },
                        },
                    },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: { $multiply: ["$quantity", "$product.Price"] } },
                        },
                    },
                ])
                .toArray();
            resolve(total[0].total);
        });
    },
    placeOrder: (order, products, total, user) => {
        return new Promise(async (resolve, reject) => {
            let status = order["payment-method"] === "COD" ? "Placed" : "Pending";
            let orderObj = {
                deliveryDetails: {
                    name: user,
                    mobile: order.mobile,
                    address: order.address,
                    pincode: order.pincode,
                },
                userId: objectId(order.userId),
                paymentMethod: order["payment-method"],
                products: products,
                totalAmount: total,
                status: status,
                date: new Date(),
            };
            db.get()
                .collection(collection.ORDER_COLLECTION)
                .insertOne(orderObj)
                .then(async (response) => {
                    await db
                        .get()
                        .collection(collection.CART_COLLECTION)
                        .removeOne({ user: objectId(order.userId) });
                    resolve(response.ops[0]._id);
                });
        });
    },
    getCartProductList: (userId) => {
        return new Promise(async (resolve, reject) => {
            let cart = await db
                .get()
                .collection(collection.CART_COLLECTION)
                .findOne({ user: objectId(userId) });
            resolve(cart.products);
        });
    },
    removeCart: (details) => {
        return new Promise((resolve, reject) => {
            db.get()
                .collection(collection.CART_COLLECTION)
                .updateOne(
                    { _id: objectId(details.cart) },
                    {
                        $pull: { products: { item: objectId(details.product) } },
                    }
                )
                .then((response) => {
                    resolve({ response });
                });
        });
    },
    getUserOrders: (userId) => {
        return new Promise(async (resolve, reject) => {
            let orders = await db
                .get()
                .collection(collection.ORDER_COLLECTION)
                .find({ userId: objectId(userId) })
                .toArray();
            resolve(orders);
        });
    },
    getOrderProducts: (orderId) => {
        return new Promise(async (resolve, reject) => {
            let orderItems = await db
                .get()
                .collection(collection.ORDER_COLLECTION)
                .aggregate([
                    {
                        $match: { _id: objectId(orderId) },
                    },
                    {
                        $unwind: "$products",
                    },
                    {
                        $project: {
                            item: "$products.item",
                            quantity: "$products.quantity",
                        },
                    },
                    {
                        $lookup: {
                            from: collection.PRODUCT_COLLECTION,
                            localField: "item",
                            foreignField: "_id",
                            as: "product",
                        },
                    },
                    {
                        $project: {
                            item: 1,
                            quantity: 1,
                            product: { $arrayElemAt: ["$product", 0] },
                        },
                    },
                ])
                .toArray();
            resolve(orderItems);
        });
    },
    generateRazorpay: (orderId, total) => {
        return new Promise((resolve, reject) => {
            var options = {
                amount: total * 100, // amount in the smallest currency unit
                currency: "INR",
                receipt: "" + orderId,
            };
            instance.orders.create(options, function (err, order) {
                if (err) {
                    console.log(err);
                } else {
                    resolve(order);
                }
            });
        });
    },
    verifyPayment: (details) => {
        return new Promise((resolve, reject) => {
            const crypto = require("crypto");
            let hash = crypto.createHmac("sha256", "nbp9eK9CkHV7iCujy1oOQOgM");
            hash.update(
                details["payment[razorpay_order_id]"] +
                "|" +
                details["payment[razorpay_payment_id]"]
            );
            hash = hash.digest("hex");
            if (hash == details["payment[razorpay_signature]"]) {
                resolve();
            } else {
                reject();
            }
        });
    },
    changePaymentStatus: (orderId) => {
        return new Promise((resolve, reject) => {
            db.get()
                .collection(collection.ORDER_COLLECTION)
                .updateOne(
                    { _id: objectId(orderId) },
                    {
                        $set: {
                            status: "Placed",
                        },
                    }
                )
                .then(() => resolve());
        });
    },
    changeCancelledStatus: (orderId) => {
        return new Promise((resolve, reject) => {
            db.get()
                .collection(collection.ORDER_COLLECTION)
                .updateOne(
                    { _id: objectId(orderId) },
                    {
                        $set: {
                            status: "Cancelled",
                        },
                    }
                )
                .then((response) => resolve(response));
        });
    },
};
