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

  function active() {
    return clean(localStorage.getItem("vasi_session_role"));
  }

  function remember(role) {
    const safeRole = clean(role);
    if (!safeRole) return "";
    localStorage.setItem("vasi_session_role", safeRole);
    localStorage.setItem("vasi_role", safeRole);
    return safeRole;
  }

  function clear() {
    localStorage.removeItem("vasi_session_role");
    localStorage.removeItem("vasi_role");
  }

  function destination(role) {
    return destinations[clean(role)] || "index.html";
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

  window.VasiAccountRole = { active, remember, clear, destination, require };
})();
