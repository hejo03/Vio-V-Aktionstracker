const db = require('../models').sequelize;
const auth = require('./auth');
const { config } = require('../config');
const { gangName, version } = config;
module.exports = () => {
   return async function (req, res, next) {
      res.locals.req = req;

      res.locals.isAuthenticated = function () {
         return !!auth.getUser(req.session.id);
      };

      res.locals.isUnauthenticated = function () {
         return !auth.getUser(req.session.id);
      };

      res.locals.env = process.env;

      if (auth.getUser(req.session.id)) {
         req.user = await db.models.User.findByPk(auth.getUser(req.session.id), {
            include: [
               {
                  association: 'Role',
               },
            ],
         });
      }
      res.locals.version = version;
      res.locals.gangName = gangName;
      res.locals.account = req.user;
      res.locals.message = {
         info: await req.consumeFlash('info'),
         error: await req.consumeFlash('error'),
         success: await req.consumeFlash('success'),
      };
      res.locals.yearNow = new Date(Date.now()).getFullYear();
      next();
   };
};
