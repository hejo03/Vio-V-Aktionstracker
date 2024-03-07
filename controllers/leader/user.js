const db = require('../../models').sequelize;
const Utility = require('../../helpers/utility');
const auth = require('../../helpers/auth');
const { Op } = require('sequelize');

exports.index = async (req, res) => {
   const users = await db.models.User.findAll({
      include: [
         {
            association: 'Role',
         },
      ],
   });

   await Promise.all(
      users.map(async (user) => {
         user.roleName = user.Role ? user.Role.name : 'keinen Rang';
         user.allowModify = user.Role ? req.user.Role.permissionLevel === 0 || req.user.Role.permissionLevel < user.Role.permissionLevel : true;
         user.isActive = auth.isUserActiveByUserId(user.id);
         return user;
      })
   );

   res.render('tracker/leader/user/index', {
      title: 'Benutzerverwaltung',
      users,
   });
};
exports.show = async (req, res) => {
   const { id } = req.params;
   const user = await db.models.User.findByPk(id);
   if (!user) {
      await req.flash('error', 'Der angegebene Spieler existiert nicht!');
      return res.redirect('/leader/users');
   }

   if (!(user.Role ? req.user.Role.permissionLevel === 0 || req.user.Role.permissionLevel < user.Role.permissionLevel : true)) {
      await req.flash('error', 'Dazu hast du keine Rechte!');
      return res.redirect('/leader/users/');
   }

   let whereCondition = {};

   if (req.user.Role.permissionLevel !== 0) {
      whereCondition = {
         permissionLevel: {
            [Op.gt]: req.user.Role.permissionLevel,
         },
      };
   }

   var roles = await db.models.Role.findAll({
      where: whereCondition,
   });
   roles.sort((a, b) => a.permissionLevel - b.permissionLevel);

   res.render('tracker/leader/user/show', {
      title: `${user.name} bearbeiten`,
      thisUser: user,
      roles,
   });
};
exports.update = async (req, res) => {
   const { id } = req.params;
   const { roleId, forumId, name, discordId } = req.body;
   const user = await db.models.User.findByPk(id);
   const role = await db.models.Role.findByPk(roleId);

   if (!role) {
      await req.flash('error', 'Ausgewählter Rang existiert nicht!');
      return res.redirect('/leader/users');
   }

   if (user) {
      if (!(user.Role ? req.user.Role.permissionLevel === 0 || req.user.Role.permissionLevel < user.Role.permissionLevel : true)) {
         await req.flash('error', 'Dazu hast du keine Rechte!');
         return res.redirect('/leader/users/');
      }

      if (role)
         if (req.user.Role.permissionLevel > role.permissionLevel) {
            await req.flash('error', 'Dazu hast du keine Rechte!');
            return res.redirect('/leader/users/');
         }
      user.roleId = roleId;
      user.name = name;
      await user.save();
      await req.flash('success', `Du hast den Spieler ${user.name} erfolgreich bearbeitet!`);
   } else {
      await req.flash('error', 'Der angegebene Spieler existiert nicht!');
   }
   res.redirect('/leader/users');
};
exports.delete = async (req, res) => {
   const { id } = req.params;
   const user = await db.models.User.findByPk(id);
   if (user) {
      await user.destroy();
      await req.flash('success', `Du hast den Spieler ${user.name} erfolgreich gelöscht!`);
   } else {
      await req.flash('error', 'Der angegebene Spieler existiert nicht!');
   }
   res.redirect('/leader/users');
};
