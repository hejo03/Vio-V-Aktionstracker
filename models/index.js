'use strict';

const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';

const config = {
   username: process.env.DB_USERNAME,
   password: process.env.DB_PASSWORD,
   database: process.env.DB_DATABASE,
   host: process.env.DB_HOST || 'localhost',
   dialect: 'mysql',
   logging: false,
   // sinnvolle Default-Pool-Einstellungen
   pool: {
      max: Number(process.env.DB_POOL_MAX) || 10,
      min: Number(process.env.DB_POOL_MIN) || 0,
      acquire: Number(process.env.DB_POOL_ACQUIRE) || 30000,
      idle: Number(process.env.DB_POOL_IDLE) || 10000,
   },
};

const db = {};

// Sequelize-Instanz
const sequelize = new Sequelize(config.database, config.username, config.password, config);

// Modelle dynamisch laden
fs.readdirSync(__dirname)
   .filter((file) => {
      // nur .js Dateien, keine versteckten, kein index.js, keine Testdateien
      return file.indexOf('.') !== 0 && file !== basename && file.slice(-3) === '.js' && !file.endsWith('.test.js') && !file.endsWith('.spec.js');
   })
   .forEach((file) => {
      const model = require(path.join(__dirname, file))(sequelize, DataTypes);
      db[model.name] = model;
   });

// Assoziationen aufbauen
Object.keys(db).forEach((modelName) => {
   if (typeof db[modelName].associate === 'function') {
      db[modelName].associate(db);
   }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;
db.env = env;

module.exports = db;
