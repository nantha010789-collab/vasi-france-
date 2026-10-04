(function () {
  "use strict";
  const rideDocuments = ["identity", "vtc", "licence", "business", "insurance", "carte_grise", "selfie"];
  const motorVehicles = new Set(["scooter", "moto", "car"]);

  function requiredDocuments(role, profile) {
    if (role === "ride") return [...rideDocuments];
    const required = ["identity", "business", "bag", "vehicle_photo", "selfie"];
    if (motorVehicles.has(profile?.vehicle_type)) required.push("licence", "insurance", "carte_grise", "transport_licence");
    return required;
  }

  function classify(role, profile, documents = [], now = Date.now()) {
    const required = requiredDocuments(role, profile);
    const docs = role === "ride" ? documents : Object.entries(profile?.documents || {}).map(([document_type, file_path]) => ({ document_type, file_path }));
    const present = required.filter(type => docs.some(doc => doc.document_type === type && doc.file_path));
    const approved = required.filter(type => docs.some(doc => doc.document_type === type && doc.file_path && doc.status === "approved"));
    const expired = docs.some(doc => required.includes(doc.document_type) && doc.expires_at && new Date(doc.expires_at).getTime() <= now);
    const status = role === "ride" ? profile?.status : profile?.application_status;
    let state = "incomplete";
    if (profile) {
      if (["rejected", "suspended"].includes(status) || docs.some(doc => doc.status === "rejected") || expired) state = "rejected";
      else if (present.length === required.length) {
        state = status === "approved" && profile.verified === true && (role !== "ride" || approved.length === required.length) ? "approved" : "pending";
      }
    }
    return { state, profile, documents: docs, required, present, approved, expired };
  }

  async function readProfile(client, role, userId) {
    if (!["ride", "courier"].includes(role) || !userId) throw new Error("Compte partenaire requis.");
    const table = role === "ride" ? "drivers" : "delivery_drivers";
    const fields = role === "ride" ? "id,status,verified,rejection_reason,full_name" : "id,application_status,verified,rejection_reason,full_name,vehicle_type,documents";
    const { data: profile, error } = await client.from(table).select(fields).eq("user_id", userId).maybeSingle();
    if (error) throw error;
    let documents = [];
    if (role === "ride" && profile) {
      const result = await client.from("driver_documents").select("document_type,status,file_path,expires_at,rejection_reason").eq("driver_id", profile.id);
      if (result.error) throw result.error;
      documents = result.data || [];
    }
    return classify(role, profile, documents);
  }

  async function read(client, role, userId) {
    let timer;
    try {
      return await Promise.race([
        readProfile(client, role, userId),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Vérification indisponible. Réessayez.")), 12000); })
      ]);
    } finally { clearTimeout(timer); }
  }

  function statusUrl(role) { return "driver-status.html?role=" + encodeURIComponent(role); }
  async function requireApproval(client, role, session) {
    try {
      const access = await read(client, role, session?.user?.id);
      if (access.state === "approved") return access;
    } catch (_) {
      // An unavailable database is never permission to reveal the workspace.
    }
    location.replace(statusUrl(role));
    return null;
  }
  window.VasiProviderAccess = { classify, requiredDocuments, read, statusUrl, requireApproval };
})();
