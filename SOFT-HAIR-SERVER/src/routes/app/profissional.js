const { profissionalAppMiddleware } = require('../../middleware/appAuth');
const router = require('../appProfissional');

router.use(profissionalAppMiddleware);

module.exports = router;
