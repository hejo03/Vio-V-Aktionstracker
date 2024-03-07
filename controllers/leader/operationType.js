const db = require('../../models').sequelize;
exports.index = async (req, res) => {
   const roles = await db.models.OperationType.findAll();

   res.render('tracker/leader/operationType/index', {
      title: 'Operationstypen',
      roles,
   });
};
exports.create = async (req, res) => {
   res.render('tracker/leader/operationType/create', {
      title: `Operationstyp erstellen`,
   });
};
exports.store = async (req, res) => {
   const { points, name } = req.body;
   if (!points || !name || name.length < 1 || isNaN(points)) {
      return res.redirect('/leader/operationTypes/create');
   }

   const operationType = await db.models.OperationType.create({
      name,
      points: parseInt(points),
   });

   await req.flash('success', `Du hast erfolgreich den Operationstyp ${operationType.name} erstellt. (Punkte: ${operationType.points})`);
   return res.redirect('/leader/operationTypes');
};
exports.show = async (req, res) => {
   const { id } = req.params;

   const operationType = await db.models.OperationType.findByPk(id);
   if (!operationType) {
      await req.flash('error', 'Der angegebene Operationstyp existiert nicht!');
      return res.redirect('/leader/operationTypes');
   }

   res.render('tracker/leader/operationType/show', {
      title: `${operationType.name} bearbeiten`,
      thisOpType: operationType,
   });
};
exports.update = async (req, res) => {
   const { id } = req.params;
   const { points, name } = req.body;
   const operationType = await db.models.OperationType.findByPk(id);

   if (operationType) {
      operationType.points = points;
      operationType.name = name;
      await operationType.save();
      await req.flash('success', `Du hast den Operationstyp ${operationType.name} erfolgreich bearbeitet!`);
   } else {
      await req.flash('error', 'Der angegebene Operationstyp existiert nicht!');
   }

   res.redirect('/leader/operationTypes');
};
exports.delete = async (req, res) => {
   const { id } = req.params;
   const operationType = await db.models.OperationType.findByPk(id);
   if (operationType) {
      await operationType.destroy();
      await req.flash('success', `Du hast den Operationstyp ${operationType.name} erfolgreich gelöscht!`);
   } else {
      await req.flash('error', 'Der angegebene Operationstyp existiert nicht!');
   }
   res.redirect('/leader/operationTypes');
};
