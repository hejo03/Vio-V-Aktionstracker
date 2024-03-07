'use strict';

class Authentication {
   static isAuthenticated(req, res, next) {
      if (!!req.user) return next();
      req.session.returnTo = req.originalUrl;
      res.redirect('/login');
   }

   static isUnauthenticated(req, res, next) {
      if (!req.user) return next();

      res.redirect('/');
   }

   static hasRank(minRank) {
      return async function (req, res, next) {
         if (!req.user.Role) {
            return res.redirect('/login');
         }

         if (req.user.Role.permissionLevel <= minRank) {
            return next();
         }
         await req.flash('error', 'Dazu hast du keine Rechte!');
         return res.redirect('/');
      };
   }

   static isLeader() {
      return async function (req, res, next) {
         if (req.user.Role.isLeader == true) {
            return next();
         }
         await req.flash('error', 'Dazu hast du keine Rechte!');
         return res.redirect('/');
      };
   }
}

module.exports = Authentication;
