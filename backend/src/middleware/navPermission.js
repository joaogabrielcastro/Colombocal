const { userHasNavKey } = require("../constants/navPermissions");

function requireNavKey(key) {
  return (req, res, next) => {
    if (userHasNavKey(req.authUser, key)) {
      return next();
    }
    return res.status(403).json({ error: "Sem permissão para esta área" });
  };
}

module.exports = { requireNavKey };
