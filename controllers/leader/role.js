const db = require('../../models').sequelize;
const { gangName } = require('../../config');

exports.index = async (req, res) => {
   const roles = await db.models.Role.findAll();

   res.render('tracker/leader/role/index', {
      title: 'Ranggruppenverwaltung',
      roles,
   });
};
exports.create = async (req, res) => {
   res.render('tracker/leader/role/create', {
      title: `Rang erstellen`,
   });
};
exports.store = async (req, res) => {
   const { permissionLevel, name, isLeader } = req.body;
   if (!permissionLevel || !name || name.length < 1 || isNaN(permissionLevel)) {
      return res.redirect('/leader/roles/create');
   }

   const role = await db.models.Role.create({
      name,
      permissionLevel,
      isLeader: isLeader == 'on' ? true : false,
   });

   await req.flash('success', `Du hast erfolgreich den Rang ${role.name} erstellt. (Level: ${role.permissionLevel})`);
   return res.redirect('/leader/roles');
};
exports.show = async (req, res) => {
   const { id } = req.params;

   const role = await db.models.Role.findByPk(id);
   if (!role) {
      await req.flash('error', 'Der angegebene Rang existiert nicht!');
      return res.redirect('/leader/roles');
   }

   res.render('tracker/leader/role/show', {
      title: `${role.name} bearbeiten`,
      thisRole: role,
   });
};
exports.update = async (req, res) => {
   const { id } = req.params;
   const { permissionLevel, name, isLeader } = req.body;
   const role = await db.models.Role.findByPk(id);

   if (role) {
      role.permissionLevel = permissionLevel;
      role.name = name;
      if (isLeader === 'on') {
         role.isLeader = 1;
      } else {
         role.isLeader = 0;
      }
      await role.save();
      await req.flash('success', `Du hast den Rang ${role.name} erfolgreich bearbeitet!`);
   } else {
      await req.flash('error', 'Der angegebene Rang existiert nicht!');
   }

   res.redirect('/leader/roles');
};
exports.delete = async (req, res) => {
   const { id } = req.params;
   const role = await db.models.Role.findByPk(id);
   if (role) {
      await role.destroy();
      await req.flash('success', `Du hast den Rang ${role.name} erfolgreich gelöscht!`);
   } else {
      await req.flash('error', 'Der angegebene Rang existiert nicht!');
   }
   res.redirect('/leader/roles');
};
