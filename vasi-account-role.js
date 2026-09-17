(function () {
  "use strict";

  const roles = new Set(["customer", "ride", "courier", "restaurant", "admin"]);
  const destinations = {
    customer: "account.html",
    ride: "driver.html",
    courier: "delivery-driver.html",
    restaurant: "restaurant-dashboard.html",
    admin: "admin/",
  };

  function clean(role) {
    return roles.has(role) ? role : "";
  }

  function destination(role) {
    return destinations[clean(role)] || "index.html";
  }

  function createScope(name) {
    const scopeKeys = {
      default: {
        sessionKey: "vasi_session_role",
        intentKey: "vasi_role",
      },
      driver: {
        sessionKey: "vasi_driver_session_role",
        intentKey: "vasi_driver_role",
      },
      partner: {
        sessionKey: "vasi_partner_session_role",
        intentKey: "vasi_partner_role",
      },
      admin: {
        sessionKey: "vasi_admin_session_role",
        intentKey: "vasi_admin_role",
      },
    };
    const { sessionKey, intentKey } = scopeKeys[name] || scopeKeys.default;

    function active() {
      return clean(localStorage.getItem(sessionKey));
    }

    function intent() {
      return clean(localStorage.getItem(intentKey));
    }

    function setIntent(role) {
      const safeRole = clean(role);
      if (!safeRole) return "";
      localStorage.setItem(intentKey, safeRole);
      return safeRole;
    }

    function remember(role) {
      const safeRole = setIntent(role);
      if (!safeRole) return "";
      localStorage.setItem(sessionKey, safeRole);
      return safeRole;
    }

    function clear() {
      localStorage.removeItem(sessionKey);
      localStorage.removeItem(intentKey);
    }

    function require(role, session) {
      const requiredRole = clean(role);
      if (!session || !requiredRole) return false;
      const signedInRole = active();
      if (!signedInRole || signedInRole !== requiredRole) {
        location.replace(
          signedInRole
            ? destination(signedInRole)
            : "auth.html?role=" + encodeURIComponent(requiredRole),
        );
        return false;
      }
      return true;
    }

    return { active, intent, setIntent, remember, clear, destination, require };
  }

  const defaultScope = createScope("default");
  window.VasiAccountRole = {
    ...defaultScope,
    scoped: createScope,
  };
})();
