Warning: truncated output (original token count: 46383)
Total output lines: 1949

(function () {
  "use strict";

  const STORAGE_KEY = "vasi_language";
  const DEFAULT_LANGUAGE = "fr";
  const DEFAULT_POLICY_KEY = "vasi_language_default_policy";
  const DEFAULT_POLICY_VERSION = "fr-en-complete-v2";
  // Customer screens retain the original six language choices.
  const CUSTOMER_LANGUAGES = ["fr", "en", "ta", "de", "ar", "hi"];
  const CUSTOMER_PAGES = new Set([
    "app", "auth", "account", "settings", "activity", "ride-flow",
    "ride-chat", "ride-history", "share-ride", "food", "food-orders",
    "food-checkout", "group-order", "delivery", "support", "safety",
    "delete-account", "business-account",
  ]);
  const pageName = (window.location?.pathname || "").split("/").pop().replace(/\.html$/, "");
  const SUPPORTED = CUSTOMER_PAGES.has(pageName) ? CUSTOMER_LANGUAGES : ["fr", "en"];
  const LABELS = {
    fr: "Français", en: "English", ta: "தமிழ்",
    de: "Deutsch", ar: "العربية", hi: "हिन्दी",
  };

  const translations = {
    fr: {
      "Identity document — front": "Pièce d’identité — recto",
      "Identity document — back": "Pièce d’identité — verso",
      "Clear photo of the original: card front or passport identity page. JPG/PNG, 10 MB maximum.": "Photo nette de l’original : recto de la carte ou page d’identité du passeport. JPG/PNG, 10 Mo maximum.",
      "Back of the same card or facing passport page. Two different photos, all edges visible, no edits.": "Verso de la même carte ou page en regard du passeport. Deux photos différentes, tous les bords visibles, sans retouche.",
      "Files selected, not approved. A filename proves neither its content nor authenticity. VASI will check the documents and consistency with your identity before activation.": "Fichiers sélectionnés, non validés. Le nom du fichier ne prouve ni son contenu ni son authenticité. VASI vérifiera les pièces et leur cohérence avec votre identité avant toute activation.",
      "Selected · not approved": "Sélectionné · non validé",
      "To be checked": "À vérifier",
      "Review and approve": "Contrôler et approuver",
      "The name alone is insufficient. Check originals, both sides, holder details and the selfie. Secure links expire automatically.": "Le nom seul ne suffit pas. Vérifiez les originaux, les deux faces, les détails du titulaire et le selfie. Les liens sécurisés expirent automatiquement.",
      "Add both photos of your identity document: front and back.": "Ajoutez les deux photos de votre pièce d’identité : recto et verso.",
      "Complete every manual document review check; a matching name alone is insufficient.": "Complétez tous les contrôles manuels ; un nom identique ne suffit pas.",
      "Record a review note (20–1000 characters), including the evidence/source checked.": "Enregistrez une note de contrôle (20–1000 caractères), avec la preuve/source vérifiée.",
      "Document changed; open the latest file before reviewing": "Le document a changé ; ouvrez la dernière version avant de le contrôler",
      "Applicant identity changed; reopen the dossier": "L’identité du demandeur a changé ; rouvrez le dossier",
      "Complete dossier including both ID sides and selfie required": "Dossier complet avec recto, verso et selfie obligatoire",
      "Enter a valid future expiry date from the original document": "Saisissez une date d’expiration future valide, lue sur l’original",
      "Documents changed; reopen the dossier before approving": "Les documents ont changé ; rouvrez le dossier avant l’approbation",
      "Check your application status": "Actualiser le statut",
      "Complete my registration": "Compléter mon inscription",
      "Correct and resubmit my application": "Corriger et renvoyer mon dossier",
      "Open my workspace": "Ouvrir mon espace professionnel",
      "APPLICATION CHECK": "VÉRIFICATION DU DOSSIER",
      "INCOMPLETE REGISTRATION": "INSCRIPTION INCOMPLÈTE",
      "AWAITING APPROVAL": "EN ATTENTE DE VALIDATION",
      "ACTION REQUIRED": "ACTION REQUISE",
      "APPLICATION APPROVED": "DOSSIER APPROUVÉ",
      "STATUS UNAVAILABLE": "STATUT INDISPONIBLE",
      "Checking your account…": "Vérification de votre compte…",
      "Checking your professional application…": "Vérification de votre dossier professionnel…",
      "Complete your registration": "Complétez votre inscription",
      "Your application is under review": "Votre dossier est en cours de vérification",
      "Your application needs correction": "Votre dossier nécessite une correction",
      "Your application has been approved": "Votre dossier a été validé",
      "Unable to check your application": "Impossible de vérifier votre dossier",
      "Signing in does not replace VASI approval of your application.": "La connexion ne remplace pas la validation de votre dossier par VASI.",
      "You are signed in, but your professional application is incomplete. Add the required documents and submit your application.": "Votre connexion est créée, mais votre dossier professionnel n’est pas complet. Ajoutez les documents requis et envoyez votre dossier.",
      "VASI must review and approve your application. Rides, earnings, bank setup and going online remain blocked before approval.": "VASI doit vérifier et approuver votre dossier. Les courses, revenus, RIB et le passage en ligne restent bloqués avant cette validation.",
      "Correct the requested documents, then resubmit your application for review. Your workspace remains blocked.": "Corrigez les pièces demandées puis renvoyez votre dossier pour vérification. Votre espace de travail reste bloqué.",
      "You can open your workspace. A verified bank account and GPS permission are still required to go online.": "Vous pouvez ouvrir votre espace professionnel. Un RIB vérifié et la permission GPS restent nécessaires pour passer en ligne.",
      "Try again with an internet connection. Your workspace remains blocked until approval is confirmed.": "Réessayez avec une connexion internet. L’espace professionnel reste bloqué tant que la validation n’est pas confirmée.",
      "Missing": "Manquant",
      "Expired": "Expiré",
      "Under review": "En vérification",
      "Approved": "Validé",
      "Rejected": "Refusé",
      "documents added": "documents ajoutés",
      "approved": "validés",
      "Identity document": "Pièce d’identité",
      "Driving licence": "Permis de conduire",
      "VTC card": "Carte VTC",
      "Business registration": "Justificatif d’entreprise",
      "Professional insurance": "Assurance professionnelle",
      "Vehicle registration": "Carte grise",
      "Verification selfie": "Selfie de vérification",
      "Delivery bag": "Sac de livraison",
      "Transport licence": "Licence de transport",
      "Vehicle photo": "Photo du véhicule",
      "The request took too long. Check your connection and try again.": "Le chargement a pris trop de temps. Vérifiez votre connexion et réessayez.",
      "Retry": "Réessayer",
      "Preview without signing in": "Voir l’aperçu sans connexion",
      "Home": "Accueil",
      "Back": "Retour",
      "Account": "Compte",
      "Activity": "Activité",
      "Login": "Connexion",
      "Settings": "Paramètres",
      "Language": "Langue",
      "App display language": "Langue d’affichage de l’application",
      "Europe mobility platform": "Plateforme de mobilité européenne",
      "Move.": "Déplacez-vous.",
      "Eat.": "Mangez.",
      "Deliver.": "Faites livrer.",
      "One VASI app for rides, food and delivery.": "VASI pour vos trajets, Food et livraisons.",
      "Ride": "Trajet",
      "Chauffeur": "Chauffeur",
      "Fast city trips": "Trajets en ville",
      "Food": "Food",
      "Food delivery": "Livraison de plats",
      "Delivery": "Livraison",
      "Send anything": "Envoyez un colis",
      "Services": "Services",
      "3 ready": "3 services disponibles",
      "France & Europe": "France et Europe",
      "Book a ride": "Commander un trajet",
      "Driver app": "Application chauffeur",
      "Customer Service": "Service client",
      "Legal & Privacy": "Juridique & confidentialité",
      "Customer": "Client",
      "Courier": "Livreur",
      "Restaurant": "Restaurant",
      "Customer login": "Connexion client",
      "Ride Driver login": "Connexion chauffeur",
      "Courier login": "Connexion livreur",
      "Restaurant owner login": "Connexion restaurateur",
      "Quick phone sign-in for VASI customers.": "Connexion rapide par téléphone pour les clients VASI.",
      "Enter your mobile number. We will send a 6-digit SMS code.": "Saisissez votre numéro de mobile. Nous vous enverrons un code SMS à 6 chiffres.",
      "VTC passenger driver account.": "Compte chauffeur VTC.",
      "Food + Delivery courier account.": "Compte livreur Food et Livraison.",
      "Manage your restaurant, menu and VASI Food orders.": "Gérez votre restaurant, votre menu et vos commandes VASI Food.",
      "Send SMS code": "Envoyer le code SMS",
      "6-digit SMS code": "Code SMS à 6 chiffres",
      "Verify & continue": "Vérifier et continuer",
      "Change phone number": "Modifier le numéro",
      "Continue": "Continuer",
      "Cancel": "Annuler",
      "Close": "Fermer",
      "Save": "Enregistrer",
      "Loading settings…": "Chargement des paramètres…",
      "Your VASI account": "Votre compte VASI",
      "Manage alerts, privacy, security, safety and app preferences.": "Gérez les alertes, la confidentialité, la sécurité et les préférences de l’application.",
      "Notifications": "Notifications",
      "Live service and safety alerts cannot be switched off inside VASI.": "Les alertes de service et de sécurité en direct ne peuvent pas être désactivées dans VASI.",
      "Ride, Food & Delivery": "Trajets, Food et Livraisons",
      "Driver, restaurant, courier and order progress": "Suivi du chauffeur, du restaurant, du livreur et de la commande",
      "Required": "Obligatoire",
      "Alert preferences": "Préférences d’alerte",
      "Check phone permission and optional alerts": "Vérifier l’autorisation du téléphone et les alertes facultatives",
      "Notification history": "Historique des notifications",
      "See recent VASI updates": "Voir les dernières mises à jour VASI",
      "Privacy": "Confidentialité",
      "Control your data and understand what VASI shares.": "Contrôlez vos données et ce que VASI partage.",
      "Location access": "Accès à la localisation",
      "Used for pickup, route and nearby drivers": "Utilisé pour le départ, l’itinéraire et les chauffeurs à proximité",
      "Phone-number privacy": "Confidentialité du numéro",
      "Your phone number is not shown to drivers or couriers": "Votre numéro n’est pas affiché aux chauffeurs ni aux livreurs",
      "Always": "Toujours",
      "Offers & marketing": "Offres et marketing",
      "Optional discounts and VASI news": "Réductions facultatives et actualités VASI",
      "Download my data": "Télécharger mes données",
      "Save a copy of your VASI account information": "Enregistrer une copie des informations de votre compte VASI",
      "Delete account": "Supprimer le compte",
      "Contact support for identity verification": "Contactez l’assistance pour vérifier votre identité",
      "Security": "Sécurité",
      "Your verified phone and secure session protect this account.": "Votre téléphone vérifié et votre session sécurisée protègent ce compte.",
      "SMS verification": "Vérification par SMS",
      "Verified VASI account": "Compte VASI vérifié",
      "On": "Activé",
      "This device": "Cet appareil",
      "Active session": "Session active",
      "Signed in": "Connecté",
      "Sign out all devices": "Déconnecter tous les appareils",
      "Require SMS login again everywhere": "Exiger une nouvelle connexion SMS partout",
      "Safety": "Sécurité",
      "Trip protection and emergency tools stay easy to reach.": "La protection du trajet et les outils d’urgence restent faciles d’accès.",
      "Safety Centre": "Centre de sécurité",
      "Emergency 112, Share Trip and driver details": "Urgence 112, partage du trajet et informations du chauffeur",
      "Safety PIN": "Code PIN de sécurité",
      "First customer ride only; every Food delivery": "Premier trajet client uniquement ; chaque livraison Food",
      "Protected": "Protégé",
      "App preferences": "Préférences de l’application",
      "Choose how VASI looks and communicates on this device.": "Choisissez l’apparence et les communications de VASI sur cet appareil.",
      "Reduce motion": "Réduire les animations",
      "Limit interface animation on this device": "Limiter les animations de l’interface sur cet appareil",
      "Country & currency": "Pays et devise",
      "Edit your regional account preferences": "Modifier vos préférences régionales",
      "Plan your ride": "Planifier votre trajet",
      "Choose your ride": "Choisissez votre trajet",
      "Confirm ride": "Confirmer le trajet",
      "Add stop": "Ajouter un arrêt",
      "Payment": "Paiement",
      "Cash": "Espèces",
      "Card": "Carte bancaire",
      "Reserve": "Réserver",
      "Now": "Maintenant",
      "Destination": "Destination",
      "Pickup": "Départ",
      "Food, your way.": "Food, à votre façon.",
      "Order from approved local restaurant partners.": "Commandez auprès de restaurants partenaires locaux approuvés.",
      "Search restaurant or food…": "Rechercher un restaurant ou un plat…",
      "Cart": "Panier",
      "Add": "Ajouter",
      "Send anything.": "Envoyez vos colis.",
      "Fast local delivery for parcels, documents and everyday items.": "Livraison locale rapide de colis, documents et objets du quotidien.",
      "Full pickup address": "Adresse complète de départ",
      "Full destination address": "Adresse complète de destination",
      "Parcel": "Colis",
      "Document": "Document",
      "Estimated delivery": "Livraison estimée",
      "Get delivery quote": "Obtenir un tarif de livraison",
      "Book VASI delivery": "Commander une livraison VASI",
      "Parcel booking is not available yet.": "La réservation de colis n’est pas encore disponible.",
      "Overview": "Vue d’ensemble",
      "Rides": "Courses",
      "Live GPS": "GPS en direct",
      "Drivers": "Chauffeurs",
      "Documents": "Documents",
      "Couriers": "Coursiers",
      "Orders": "Commandes",
      "Payments": "Paiements",
      "Pricing": "Tarifs",
      "Support": "Support",
      "Audit log": "Journal",
      "OPERATIONS": "OPÉRATIONS",
      "Operations centre": "Centre d’opérations",
      "Connected": "Connecté",
      "Unavailable": "Indisponible",
      "Sign out": "Déconnexion",
      "Secure data loading…": "Chargement des données sécurisées…",
      "Loading…": "Chargement…",
      "Live data": "Données en direct",
      "Data unavailable.": "Données indisponibles.",
      "Search…": "Rechercher…",
      "All statuses": "Tous les statuts",
      "Refresh": "Actualiser",
      "No data yet.": "Aucune donnée pour le moment.",
      "Active rides": "Courses actives",
      "Drivers online": "Chauffeurs en ligne",
      "Documents to review": "Documents à vérifier",
      "Couriers pending": "Coursiers en attente",
      "Restaurants pending": "Restaurants en attente",
      "Customers": "Clients",
      "Gross revenue today": "Chiffre brut aujourd’hui",
      "Financial summary": "Résumé financier",
      "VASI commission": "Commission VASI",
      "Driver earnings": "Revenus chauffeurs",
      "Driver bank accounts ready": "RIB chauffeurs prêts",
      "Partner bank accounts ready": "RIB partenaires prêts",
      "Today": "Aujourd’hui",
      "Stripe verified": "Stripe vérifié",
      "Couriers + restaurants": "Coursiers + restaurants",
      "Route": "Trajet",
      "Price": "Prix",
      "Status": "Statut",
      "Driver": "Chauffeur",
      "Assigned": "Affecté",
      "Unassigned": "Non affecté",
      "Ride management": "Gestion des courses",
      "Vehicle": "Véhicule",
      "Verification": "Vérification",
      "Actions": "Actions",
      "Payment": "Paiement",
      "Unnamed": "Sans nom",
      "No registration": "Sans immatriculation",
      "Remove approval": "Retirer validation",
      "Approve": "Approuver",
      "Validate": "Valider",
      "Take offline": "Mettre hors ligne",
      "Take online": "Mettre en ligne",
      "Driver and vehicles": "Chauffeurs et véhicules",
      "Document review": "Vérification des documents",
      "Reject": "Refuser",
      "Courier review": "Validation des coursiers",
      "Pending": "En attente",
      "Approved": "Approuvés",
      "Rejected": "Refusés",
      "Created": "Créé",
      "Bank payout": "Paiement",
      "Bank account verified": "RIB vérifié",
      "Bank account to connect": "RIB à connecter",
      "Partner applications": "Demandes partenaires",
      "Menu photos to review": "Photos de menu à vérifier",
      "Commission": "Commission",
      "VASI Food orders": "Commandes VASI Food",
      "Parcel deliveries": "Livraisons de colis",
      "Payouts": "Versements",
      "Payout readiness": "Préparation des versements",
      "Partners": "Partenaires",
      "Bank accounts ready": "RIB prêts",
      "Bank accounts to connect": "RIB à connecter",
      "Cash commission debt": "Dette commission espèces",
      "Driver payout history": "Historique des versements chauffeurs",
      "Amount": "Montant",
      "Error": "Erreur",
      "Date": "Date",
      "Administration audit log": "Journal d’administration",
      "Target": "Cible",
      "Administrator": "Administrateur",
      "Details": "Détails",
      "Pricing & offers": "Tarifs & offres",
      "Edit pricing": "Modifier les tarifs",
      "Manage promo codes": "Gérer les codes promo",
      "Customer and partner tickets": "Tickets clients et partenaires",
      "Account type": "Compte",
      "Message": "Message",
      "Priority": "Priorité",
      "Reply": "Répondre",
      "Live drivers": "Chauffeurs en direct",
      "Automatic refresh every 15 seconds": "Actualisation automatique toutes les 15 secondes",
      "Loading driver positions…": "Chargement des positions…",
      "Interactive live driver map": "Carte interactive des chauffeurs en direct",
      "Loading map…": "Chargement de la carte…",
      "Map legend": "Légende de la carte",
      "Recent position": "Position récente",
      "Refresh needed": "À actualiser",
      "The map could not be loaded. Check your internet connection.": "La carte ne peut pas être chargée. Vérifiez la connexion internet.",
      "The map reconnects automatically. Check your connection if it remains unavailable.": "La carte se reconnecte automatiquement. Vérifiez votre connexion si elle reste indisponible.",
      "Old position": "Position ancienne",
      "Just now": "À l’instant",
      "No verified driver is online. The map is ready and positions will appear automatically.": "Aucun chauffeur vérifié en ligne. La carte est prête et les positions apparaîtront automatiquement.",
      "Positions temporarily unavailable. Retrying automatically…": "Positions temporairement indisponibles. Nouvelle tentative automatique…",
    },
    ta: {
      "Preview without signing in": "உள்நுழையாமல் முன்னோட்டத்தைப் பார்க்கவும்",
      "Home": "முகப்பு", "Back": "பின்செல்", "Account": "கணக்கு", "Activity": "செயல்பாடுகள்", "Login": "உள்நுழைவு", "Settings": "அமைப்புகள்", "Language": "மொழி", "App display language": "செயலி காட்சி மொழி",
      "Europe mobility platform": "ஐரோப்பிய போக்குவரத்து தளம்", "Move.": "பயணம்.", "Eat.": "உணவு.", "Deliver.": "டெலிவரி.", "One VASI app for rides, food and delivery.": "பயணம், உணவு மற்றும் டெலிவரிக்கு ஒரே VASI செயலி.",
      "Ride": "பயணம்", "Fast city trips": "விரைவான நகரப் பயணங்கள்", "Food": "உணவு", "Food delivery": "உணவு டெலிவரி", "Delivery": "டெலிவரி", "Send anything": "பொருட்களை அனுப்புங்கள்", "Services": "சேவைகள்", "3 ready": "3 சேவைகள் தயார்", "France & Europe": "பிரான்ஸ் மற்றும் ஐரோப்பா", "Book a ride": "பயணம் பதிவு செய்யுங்கள்", "Driver app": "ஓட்டுநர் செயலி", "Customer Service": "வாடிக்கையாளர் சேவை",
      "Customer": "வாடிக்கையாளர்", "Courier": "டெலிவரி பணியாளர்", "Restaurant": "உணவகம்", "Customer login": "வாடிக்கையாளர் உள்நுழைவு", "Ride Driver login": "ஓட்டுநர் உள்நுழைவு", "Courier login": "டெலிவரி பணியாளர் உள்நுழைவு", "Restaurant owner login": "உணவக உரிமையாளர் உள்நுழைவு",
      "Enter your mobile number. We will send a 6-digit SMS code.": "உங்கள் மொபைல் எண்ணை உள்ளிடுங்கள். 6 இலக்க SMS குறியீட்டை அனுப்புவோம்.", "Send SMS code": "SMS குறியீட்டை அனுப்பவும்", "6-digit SMS code": "6 இலக்க SMS குறியீடு", "Verify & continue": "சரிபார்த்து தொடரவும்", "Change phone number": "தொலைபேசி எண்ணை மாற்றவும்", "Continue": "தொடரவும்", "Cancel": "ரத்து", "Close": "மூடு", "Save": "சேமிக்கவும்",
      "Your VASI account": "உங்கள் VASI கணக்கு", "Manage alerts, privacy, security, safety and app preferences.": "அறிவிப்புகள், தனியுரிமை, பாதுகாப்பு மற்றும் செயலி விருப்பங்களை நிர்வகிக்கவும்.", "Notifications": "அறிவிப்புகள்", "Alert preferences": "அறிவிப்பு விருப்பங்கள்", "Notification history": "அறிவிப்பு வரலாறு", "Privacy": "தனியுரிமை", "Location access": "இருப்பிட அனுமதி", "Phone-number privacy": "தொலைபேசி எண் தனியுரிமை", "Offers & marketing": "சலுகைகள் மற்றும் விளம்பரம்", "Download my data": "என் தரவைப் பதிவிறக்கவும்", "Delete account": "கணக்கை நீக்கவும்", "Security": "பாதுகாப்பு", "SMS verification": "SMS சரிபார்ப்பு", "This device": "இந்த சாதனம்", "Active session": "செயலில் உள்ள அமர்வு", "Signed in": "உள்நுழைந்துள்ளது", "Sign out all devices": "அனைத்து சாதனங்களிலிருந்தும் வெளியேறவும்", "Safety": "பாதுகாப்பு", "Safety Centre": "பாதுகாப்பு மையம்", "Safety PIN": "பாதுகாப்பு PIN", "Protected": "பாதுகாக்கப்பட்டது", "App preferences": "செயலி விருப்பங்கள்", "Reduce motion": "அசைவைக் குறைக்கவும்", "Country & currency": "நாடு மற்றும் நாணயம்",
      "Plan your ride": "பயணத்தை திட்டமிடுங்கள்", "Choose your ride": "பயணத்தை தேர்வு செய்யுங்கள்", "Confirm ride": "பயணத்தை உறுதிப்படுத்துங்கள்", "Add stop": "நிறுத்தம் சேர்க்கவும்", "Payment": "கட்டணம்", "Cash": "பணம்", "Card": "அட்டை", "Reserve": "முன்பதிவு", "Now": "இப்போது", "Destination": "செல்லும் இடம்", "Pickup": "புறப்படும் இடம்", "Food, your way.": "உங்கள் விருப்பப்படி உணவு.", "Search restaurant or food…": "உணவகம் அல்லது உணவைத் தேடுங்கள்…", "Cart": "கூடை", "Add": "சேர்க்கவும்", "Send anything.": "எதையும் அனுப்புங்கள்.", "Full pickup address": "முழு பிக்கப் முகவரி", "Full destination address": "முழு சேருமிட முகவரி", "Parcel": "பார்சல்", "Document": "ஆவணம்", "Estimated delivery": "மதிப்பிடப்பட்ட டெலிவரி", "Get delivery quote": "டெலிவரி விலையைப் பெறவும்", "Book VASI delivery": "VASI டெலிவரியை பதிவு செய்யவும்",
    },
    de: {
      "Preview without signing in": "Vorschau ohne Anmeldung ansehen",
      "Home": "Startseite", "Back": "Zurück", "Account": "Konto", "Activity": "Aktivität", "Login": "Anmelden", "Settings": "Einstellungen", "Language": "Sprache", "App display language": "Anzeigesprache der App",
      "Europe mobility platform": "Europäische Mobilitätsplattform", "Move.": "Fahren.", "Eat.": "Essen.", "Deliver.": "Liefern.", "One VASI app for rides, food and delivery.": "Eine VASI-App für Fahrten, Essen und Lieferungen.",
      "Ride": "Fahrt", "Fast city trips": "Schnelle Stadtfahrten", "Food": "Essen", "Food delivery": "Essenslieferung", "Delivery": "Lieferung", "Send anything": "Alles versenden", "Services": "Dienste", "3 ready": "3 Dienste bereit", "France & Europe": "Frankreich und Europa", "Book a ride": "Fahrt buchen", "Driver app": "Fahrer-App", "Customer Service": "Kundenservice",
      "Customer": "Kunde", "Courier": "Kurier", "Restaurant": "Restaurant", "Customer login": "Kundenanmeldung", "Ride Driver login": "Fahreranmeldung", "Courier login": "Kurier-Anmeldung", "Restaurant owner login": "Restaurant-Anmeldung", "Enter your mobile number. We will send a 6-digit SMS code.": "Geben Sie Ihre Mobilnummer ein. Wir senden einen 6-stelligen SMS-Code.", "Send SMS code": "SMS-Code senden", "6-digit SMS code": "6-stelliger SMS-Code", "Verify & continue": "Prüfen und fortfahren", "Change phone number": "Telefonnummer ändern", "Continue": "Weiter", "Cancel": "Abbrechen", "Close": "Schließen", "Save": "Speichern",
      "Your VASI account": "Ihr VASI-Konto", "Notifications": "Benachrichtigungen", "Alert preferences": "Benachrichtigungseinstellungen", "Notification history": "Benachrichtigungsverlauf", "Privacy": "Datenschutz", "Location access": "Standortzugriff", "Phone-number privacy": "Telefonnummer schützen", "Offers & marketing": "Angebote und Marketing", "Download my data": "Meine Daten herunterladen", "Delete account": "Konto löschen", "Security": "Sicherheit", "SMS verification": "SMS-Bestätigung", "This device": "Dieses Gerät", "Active session": "Aktive Sitzung", "Signed in": "Angemeldet", "Sign out all devices": "Auf allen Geräten abmelden", "Safety": "Sicherheit", "Safety Centre": "Sicherheitscenter", "Safety PIN": "Sicherheits-PIN", "Protected": "Geschützt", "App preferences": "App-Einstellungen", "Reduce motion": "Bewegung reduzieren", "Country & currency": "Land und Währung",
      "Plan your ride": "Fahrt planen", "Choose your ride": "Fahrt auswählen", "Confirm ride": "Fahrt bestätigen", "Add stop": "Stopp hinzufügen", "Payment": "Zahlung", "Cash": "Bargeld", "Card": "Karte", "Reserve": "Reservieren", "Now": "Jetzt", "Destination": "Ziel", "Pickup": "Abholung", "Food, your way.": "Essen nach Ihrem Geschmack.", "Search restaurant or food…": "Restaurant oder Essen suchen…", "Cart": "Warenkorb", "Add": "Hinzufügen", "Send anything.": "Alles versenden.", "Full pickup address": "Vollständige Abholadresse", "Full destination address": "Vollständige Zieladresse", "Parcel": "Paket", "Document": "Dokument", "Estimated delivery": "Geschätzte Lieferung", "Get delivery quote": "Lieferpreis berechnen", "Book VASI delivery": "VASI-Lieferung buchen",
    },
    ar: {
      "Preview without signing in": "عرض المعاينة من دون تسجيل الدخول",
      "Home": "الرئيسية", "Back": "رجوع", "Account": "الحساب", "Activity": "النشاط", "Login": "تسجيل الدخول", "Settings": "الإعدادات", "Language": "اللغة", "App display language": "لغة عرض التطبيق",
      "Europe mobility platform": "منصة التنقل الأوروبية", "Move.": "تنقّل.", "Eat.": "اطلب الطعام.", "Deliver.": "أرسل.", "One VASI app for rides, food and delivery.": "تطبيق VASI واحد للرحلات والطعام والتوصيل.",
      "Ride": "رحلة", "Fast city trips": "رحلات سريعة داخل المدينة", "Food": "الطعام", "Food delivery": "توصيل الطعام", "Delivery": "التوصيل", "Send anything": "أرسل أي شيء", "Services": "الخدمات", "3 ready": "3 خدمات جاهزة", "France & Europe": "فرنسا وأوروبا", "Book a ride": "احجز رحلة", "Driver app": "تطبيق السائق", "Customer Service": "خدمة العملاء",
      "Customer": "العميل", "Courier": "مندوب التوصيل", "Restaurant": "المطعم", "Customer login": "دخول العميل", "Ride Driver login": "دخول السائق", "Courier login": "دخول مندوب التوصيل", "Restaurant owner login": "دخول صاحب المطعم", "Enter your mobile number. We will send a 6-digit SMS code.": "أدخل رقم هاتفك المحمول. سنرسل رمزاً من 6 أرقام عبر SMS.", "Send SMS code": "إرسال رمز SMS", "6-digit SMS code": "رمز SMS من 6 أرقام", "Verify & continue": "تحقق وتابع", "Change phone number": "تغيير رقم الهاتف", "Continue": "متابعة", "Cancel": "إلغاء", "Close": "إغلاق", "Save": "حفظ",
      "Your VASI account": "حساب VASI الخاص بك", "Notifications": "الإشعارات", "Alert preferences": "تفضيلات التنبيه", "Notification history": "سجل الإشعارات", "Privacy": "الخصوصية", "Location access": "الوصول إلى الموقع", "Phone-number privacy": "خصوصية رقم الهاتف", "Offers & marketing": "العروض والتسويق", "Download my data": "تنزيل بياناتي", "Delete account": "حذف الحساب", "Security": "الأمان", "SMS verification": "التحقق عبر SMS", "This device": "هذا الجهاز", "Active session": "جلسة نشطة", "Signed in": "تم تسجيل الدخول", "Sign out all devices": "تسجيل الخروج من جميع الأجهزة", "Safety": "السلامة", "Safety Centre": "مركز السلامة", "Safety PIN": "رمز PIN للسلامة", "Protected": "محمي", "App preferences": "تفضيلات التطبيق", "Reduce motion": "تقليل الحركة", "Country & currency": "البلد والعملة",
      "Plan your ride": "خطط لرحلتك", "Choose your ride": "اختر رحلتك", "Confirm ride": "تأكيد الرحلة", "Add stop": "إضافة محطة", "Payment": "الدفع", "Cash": "نقداً", "Card": "بطاقة", "Reserve": "حجز", "Now": "الآن", "Destination": "الوجهة", "Pickup": "موقع الانطلاق", "Food, your way.": "طعامك كما تحب.", "Search restaurant or food…": "ابحث عن مطعم أو طعام…", "Cart": "السلة", "Add": "إضافة", "Send anything.": "أرسل أي شيء.", "Full pickup address": "عنوان الاستلام الكامل", "Full destination address": "عنوان الوجهة الكامل", "Parcel": "طرد", "Document": "مستند", "Estimated delivery": "التوصيل المتوقع", "Get delivery quote": "احصل على سعر التوصيل", "Book VASI delivery": "احجز توصيل VASI",
    },
    hi: {
      "Preview without signing in": "साइन इन किए बिना पूर्वावलोकन देखें",
      "Home": "होम", "Back": "वापस", "Account": "खाता", "Activity": "गतिविधि", "Login": "लॉग इन", "Settings": "सेटिंग्स", "Language": "भाषा", "App display language": "ऐप की भाषा",
      "Europe mobility platform": "यूरोप मोबिलिटी प्लेटफ़ॉर्म", "Move.": "यात्रा.", "Eat.": "खाना.", "Deliver.": "डिलीवरी.", "One VASI app for rides, food and delivery.": "राइड, खाना और डिलीवरी के लिए एक VASI ऐप.",
      "Ride": "राइड", "Fast city trips": "तेज़ शहर यात्राएँ", "Food": "खाना", "Food delivery": "खाने की डिलीवरी", "Delivery": "डिलीवरी", "Send anything": "कुछ भी भेजें", "Services": "सेवाएँ", "3 ready": "3 सेवाएँ तैयार", "France & Europe": "फ़्रांस और यूरोप", "Book a ride": "राइड बुक करें", "Driver app": "ड्राइवर ऐप", "Customer Service": "ग्राहक सेवा",
      "Customer": "ग्राहक", "Courier": "कूरियर", "Restaurant": "रेस्टोरेंट", "Customer login": "ग्राहक लॉग इन", "Ride Driver login": "ड्राइवर लॉग इन", "Courier login": "कूरियर लॉग इन", "Restaurant owner login": "रेस्टोरेंट मालिक लॉग इन", "Enter your mobile number. We will send a 6-digit SMS code.": "अपना मोबाइल नंबर डालें। हम 6 अंकों का SMS कोड भेजेंगे।", "Send SMS code": "SMS कोड भेजें", "6-digit SMS code": "6 अंकों का SMS कोड", "Verify & continue": "सत्यापित करें और आगे बढ़ें", "Change phone number": "फ़ोन नंबर बदलें", "Continue": "आगे बढ़ें", "Cancel": "रद्द करें", "Close": "बंद करें", "Save": "सेव करें",
      "Your VASI account": "आपका VASI खाता", "Notifications": "सूचनाएँ", "Alert preferences": "सूचना प्राथमिकताएँ", "Notification history": "सूचना इतिहास", "Privacy": "गोपनीयता", "Location access": "लोकेशन अनुमति", "Phone-number privacy": "फ़ोन नंबर गोपनीयता", "Offers & marketing": "ऑफ़र और मार्केटिंग", "Download my data": "मेरा डेटा डाउनलोड करें", "Delete account": "खाता हटाएँ", "Security": "सुरक्षा", "SMS verification": "SMS सत्यापन", "This device": "यह डिवाइस", "Active session": "सक्रिय सत्र", "Signed in": "लॉग इन है", "Sign out all devices": "सभी डिवाइस से लॉग आउट करें", "Safety": "सुरक्षा", "Safety Centre": "सुरक्षा केंद्र", "Safety PIN": "सुरक्षा PIN", "Protected": "सुरक्षित", "App preferences": "ऐप प्राथमिकताएँ", "Reduce motion": "एनीमेशन कम करें", "Country & currency": "देश और मुद्रा",
      "Plan your ride": "अपनी राइड की योजना बनाएँ", "Choose your ride": "अपनी राइड चुनें", "Confirm ride": "राइड की पुष्टि करें", "Add stop": "स्टॉप जोड़ें", "Payment": "भुगतान", "Cash": "नकद", "Card": "कार्ड", "Reserve": "आरक्षित करें", "Now": "अभी", "Destination": "मंज़िल", "Pickup": "पिकअप", "Food, your way.": "खाना, आपकी पसंद का.", "Search restaurant or food…": "रेस्टोरेंट या खाना खोजें…", "Cart": "कार्ट", "Add": "जोड़ें", "Send anything.": "कुछ भी भेजें.", "Full pickup address": "पूरा पिकअप पता", "Full destination address": "मंज़िल का पूरा पता", "Parcel": "पार्सल", "Document": "दस्तावेज़", "Estimated delivery": "अनुमानित डिलीवरी", "Get delivery quote": "डिलीवरी कीमत देखें", "Book VASI delivery": "VASI डिलीवरी बुक करें",
    },
  };

  const extendedTranslations = {
    fr: {
      "Driver": "Chauffeur", "Ride partner": "Partenaire de trajet", "Ride chat": "Chat du trajet", "Chat with your driver": "Chat avec votre chauffeur", "Chat with your customer": "Chat avec votre client", "Live chat & calls": "Chat et appels en direct", "Voice call": "Appel vocal", "Start voice call": "Démarrer l’appel vocal", "Incoming voice call": "Appel vocal entrant", "Calling": "Appel de", "is calling": "vous appelle", "Joining": "Connexion avec", "Starting microphone…": "Activation du microphone…", "Waiting for an answer": "En attente d’une réponse", "Connected": "Connecté", "Reconnecting…": "Reconnexion…", "Decline": "Refuser", "Answer": "Répondre", "Mute": "Couper le micro", "Unmute": "Activer le micro", "End call": "Raccrocher", "Call declined": "Appel refusé", "Call ended": "Appel terminé", "No answer": "Aucune réponse", "Call connection failed. Please try again.": "Échec de la connexion. Réessayez.", "Voice calls are not supported by this browser.": "Les appels vocaux ne sont pas pris en charge par ce navigateur.", "Allow microphone access in your phone settings, then try again.": "Autorisez le microphone dans les réglages du téléphone, puis réessayez.", "The microphone could not be started. Please try again.": "Le microphone n’a pas pu démarrer. Réessayez.", "Chat · Voice call": "Chat · Appel vocal",
      "Resend SMS code": "Renvoyer le code SMS", "Requesting new code…": "Demande d’un nouveau code…", "Checking your code…": "Vérification du code…", "Enter the most recently received 6-digit SMS code.": "Saisissez le dernier code SMS à 6 chiffres reçu.", "This SMS code has expired or was already used. Tap Resend SMS code for a new code.": "Ce code SMS a expiré ou a déjà été utilisé. Touchez Renvoyer le code SMS.", "The SMS code is incorrect. Check the newest message and try again.": "Le code SMS est incorrect. Vérifiez le message le plus récent.",
      "Drive with VASI": "Conduisez avec VASI", "Go online": "Se mettre en ligne", "ONLINE": "EN LIGNE", "OFFLINE": "HORS LIGNE", "Verified driver": "Chauffeur vérifié", "Verification required": "Vérification requise", "Current ride": "Trajet actuel", "No active ride": "Aucun trajet actif", "Ride requests": "Demandes de trajet", "No new ride requests.": "Aucune nouvelle demande.", "Accept ride": "Accepter le trajet", "Start Ride": "Démarrer le trajet", "Complete Ride": "Terminer le trajet", "Open navigation to pickup": "Ouvrir la navigation vers le départ", "Arrived at Pickup": "Arrivé au point de départ", "Food orders": "Commandes Food", "Deliveries": "Livraisons", "Connect Stripe": "Connecter Stripe", "Sign out": "Déconnexion",
      "Grow your restaurant.": "Développez votre restaurant.", "Join VASI": "Rejoindre VASI", "Partner dashboard": "Tableau de bord partenaire", "Restaurant name": "Nom du restaurant", "Business email": "E-mail professionnel", "Restaurant address": "Adresse du restaurant", "Submit for VASI approval": "Envoyer pour validation VASI", "Menu": "Menu", "Orders": "Commandes", "Add item": "Ajouter un article", "No menu items yet.": "Aucun article pour le moment.", "No orders yet.": "Aucune commande pour le moment.", "Online": "En ligne", "Offline": "Hors ligne", "Approve": "Approuver", "Reject": "Refuser", "Dashboard": "Tableau de bord", "Refresh": "Actualiser",
      "Incoming VASI voice call": "Appel vocal VASI entrant", "Your ride partner is calling inside VASI.": "Votre partenaire de trajet vous appelle dans VASI.", "Enable phone alerts": "Activer les alertes", "Alerts enabled": "Alertes activées", "Updates": "Mises à jour", "Mark all read": "Tout marquer comme lu", "Test phone alert": "Tester l’alerte du téléphone", "Check notifications on this device": "Vérifier les notifications sur cet appareil", "VASI test successful": "Test VASI réussi", "Phone alerts work on this device. Keep VASI installed for ride updates.": "Les alertes fonctionnent sur cet appareil. Gardez VASI installé pour recevoir les mises à jour."
    },
    ta: {
      "Driver": "ஓட்டுநர்", "Ride partner": "பயணத் துணை", "Ride chat": "பயண அரட்டை", "Chat with your driver": "ஓட்டுநருடன் அரட்டை", "Chat with your customer": "வாடிக்கையாளருடன் அரட்டை", "Live chat & calls": "நேரடி அரட்டை மற்றும் அழைப்புகள்", "Voice call": "குரல் அழைப்பு", "Start voice call": "குரல் அழைப்பைத் தொடங்கவும்", "Incoming voice call": "உள்வரும் குரல் அழைப்பு", "Calling": "அழைக்கிறது", "is calling": "அழைக்கிறார்", "Joining": "இணைகிறது", "Starting microphone…": "மைக்ரோஃபோன் தொடங்குகிறது…", "Waiting for an answer": "பதில் காத்திருக்கிறது", "Connected": "இணைக்கப்பட்டது", "Reconnecting…": "மீண்டும் இணைகிறது…", "Decline": "நிராகரி", "Answer": "பதிலளி", "Mute": "ஒலியை நிறுத்து", "Unmute": "ஒலியை இயக்கு", "End call": "அழைப்பை முடி", "Call declined": "அழைப்பு நிராகரிக்கப்பட்டது", "Call ended": "அழைப்பு முடிந்தது", "No answer": "பதில் இல்லை", "Call connection failed. Please try again.": "அழைப்பு இணைப்பு தோல்வியடைந்தது. மீண்டும் முயற்சிக்கவும்.", "Voice calls are not supported by this browser.": "இந்த browser-ல் குரல் அழைப்பு ஆதரிக்கப்படவில்லை.", "Allow microphone access in your phone settings, then try again.": "Phone settings-ல் microphone அனுமதியை வழங்கி மீண்டும் முயற்சிக்கவும்.", "The microphone could not be started. Please try again.": "மைக்ரோஃபோனை தொடங்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.", "Chat · Voice call": "அரட்டை · குரல் அழைப்பு",
      "Resend SMS code": "SMS குறியீட்டை மீண்டும் அனுப்பவும்", "Requesting new code…": "புதிய குறியீடு கேட்கப்படுகிறது…", "Checking your code…": "குறியீடு சரிபார்க்கப்படுகிறது…", "Enter the most recently received 6-digit SMS code.": "கடைசியாக வந்த 6 இலக்க SMS குறியீட்டை உள்ளிடவும்.", "This SMS code has expired or was already used. Tap Resend SMS code for a new code.": "இந்த SMS குறியீடு காலாவதியானது அல்லது பயன்படுத்தப்பட்டது. புதிய குறியீட்டுக்கு மீண்டும் அனுப்பவும் என்பதைத் தட்டவும்.", "The SMS code is incorrect. Check the newest message and try again.": "SMS குறியீடு தவறு. புதிய செய்தியைப் பார்த்து மீண்டும் முயற்சிக்கவும்.",
      "Drive with VASI": "VASI உடன் ஓட்டுங்கள்", "Go online": "Online செல்லவும்", "ONLINE": "ONLINE", "OFFLINE": "OFFLINE", "Verified driver": "சரிபார்க்கப்பட்ட ஓட்டுநர்", "Verification required": "சரிபார்ப்பு தேவை", "Current ride": "தற்போதைய பயணம்", "No active ride": "செயலில் பயணம் இல்லை", "Ride requests": "பயண கோரிக்கைகள்", "No new ride requests.": "புதிய பயண கோரிக்கைகள் இல்லை.", "Accept ride": "பயணத்தை ஏற்கவும்", "Start Ride": "பயணத்தைத் தொடங்கவும்", "Complete Ride": "பயணத்தை முடிக்கவும்", "Open navigation to pickup": "பிக்கப்புக்கு வழிகாட்டலைத் திறக்கவும்", "Arrived at Pickup": "பிக்கப் இடம் வந்துவிட்டேன்", "Food orders": "உணவு ஆர்டர்கள்", "Deliveries": "டெலிவரிகள்", "Connect Stripe": "Stripe இணைக்கவும்", "Sign out": "வெளியேறு",
      "Grow your restaurant.": "உங்கள் உணவகத்தை வளருங்கள்.", "Join VASI": "VASI-ல் இணையுங்கள்", "Partner dashboard": "பார்ட்னர் டாஷ்போர்டு", "Restaurant name": "உணவகப் பெயர்", "Business email": "வணிக மின்னஞ்சல்", "Restaurant address": "உணவக முகவரி", "Submit for VASI approval": "VASI அனுமதிக்கு அனுப்பவும்", "Menu": "மெனு", "Orders": "ஆர்டர்கள்", "Add item": "உணவைச் சேர்க்கவும்", "No menu items yet.": "மெனு உணவுகள் இன்னும் இல்லை.", "No orders yet.": "ஆர்டர்கள் இன்னும் இல்லை.", "Online": "Online", "Offline": "Offline", "Approve": "அனுமதி", "Reject": "நிராகரி", "Dashboard": "டாஷ்போர்டு", "Refresh": "புதுப்பிக்கவும்",
      "Incoming VASI voice call": "உள்வரும் VASI குரல் அழைப்பு", "Your ride partner is calling inside VASI.": "உங்கள் பயணத் துணை VASI-க்குள் அழைக்கிறார்.", "Enable phone alerts": "Phone அறிவிப்புகளை இயக்கவும்", "Alerts enabled": "அறிவிப்புகள் இயக்கப்பட்டன", "Updates": "புதுப்பிப்புகள்", "Mark all read": "அனைத்தையும் படித்ததாகக் குறிக்கவும்", "Test phone alert": "Phone அறிவிப்பை சோதிக்கவும்", "Check notifications on this device": "இந்தச் சாதனத்தில் அறிவிப்புகளைச் சரிபார்க்கவும்", "VASI test successful": "VASI சோதனை வெற்றியடைந்தது", "Phone alerts work on this device. Keep VASI installed for ride updates.": "இந்தச் சாதனத்தில் Phone அறிவிப்புகள் செயல்படுகின்றன. பயண புதுப்பிப்புகளுக்கு VASI-ஐ நிறுவி வைத்திருங்கள்."
    },
    de: {
      "Driver": "Fahrer", "Ride partner": "Fahrtpartner", "Ride chat": "Fahrt-Chat", "Chat with your driver": "Chat mit Ihrem Fahrer", "Chat with your customer": "Chat mit Ihrem Kunden", "Live chat & calls": "Live-Chat und Anrufe", "Voice call": "Sprachanruf", "Start voice call": "Sprachanruf starten", "Incoming voice call": "Eingehender Sprachanruf", "Calling": "Anruf an", "is calling": "ruft an", "Joining": "Verbindung mit", "Starting microphone…": "Mikrofon wird gestartet…", "Waiting for an answer": "Warten auf Antwort", "Connected": "Verbunden", "Reconnecting…": "Erneute Verbindung…", "Decline": "Ablehnen", "Answer": "Annehmen", "Mute": "Stumm", "Unmute": "Ton an", "End call": "Anruf beenden", "Call declined": "Anruf abgelehnt", "Call ended": "Anruf beendet", "No answer": "Keine Antwort", "Call connection failed. Please try again.": "Anrufverbindung fehlgeschlagen. Bitte erneut versuchen.", "Voice calls are not supported by this browser.": "Dieser Browser unterstützt keine Sprachanrufe.", "Allow microphone access in your phone settings, then try again.": "Erlauben Sie den Mikrofonzugriff in den Telefoneinstellungen.", "The microphone could not be started. Please try again.": "Das Mikrofon konnte nicht gestartet werden.", "Chat · Voice call": "Chat · Sprachanruf",
      "Resend SMS code": "SMS-Code erneut senden", "Requesting new code…": "Neuer Code wird angefordert…", "Checking your code…": "Code wird geprüft…", "Enter the most recently received 6-digit SMS code.": "Geben Sie den zuletzt erhaltenen 6-stelligen SMS-Code ein.", "This SMS code has expired or was already used. Tap Resend SMS code for a new code.": "Dieser SMS-Code ist abgelaufen oder wurde bereits verwendet. Fordern Sie einen neuen an.", "The SMS code is incorrect. Check the newest message and try again.": "Der SMS-Code ist falsch. Prüfen Sie die neueste Nachricht.",
      "Drive with VASI": "Mit VASI fahren", "Go online": "Online gehen", "ONLINE": "ONLINE", "OFFLINE": "OFFLINE", "Verified driver": "Verifizierter Fahrer", "Verification required": "Verifizierung erforderlich", "Current ride": "Aktuelle Fahrt", "No active ride": "Keine aktive Fahrt", "Ride requests": "Fahrtanfragen", "No new ride requests.": "Keine neuen Fahrtanfragen.", "Accept ride": "Fahrt annehmen", "Start Ride": "Fahrt starten", "Complete Ride": "Fahrt abschließen", "Open navigation to pickup": "Navigation zur Abholung öffnen", "Arrived at Pickup": "An der Abholung angekommen", "Food orders": "Essensbestellungen", "Deliveries": "Lieferungen", "Connect Stripe": "Stripe verbinden", "Sign out": "Abmelden",
      "Grow your restaurant.": "Lassen Sie Ihr Restaurant wachsen.", "Join VASI": "VASI beitreten", "Partner dashboard": "Partner-Dashboard", "Restaurant name": "Restaurantname", "Business email": "Geschäftliche E-Mail", "Restaurant address": "Restaurantadresse", "Submit for VASI approval": "Zur VASI-Prüfung senden", "Menu": "Speisekarte", "Orders": "Bestellungen", "Add item": "Artikel hinzufügen", "No menu items yet.": "Noch keine Menüartikel.", "No orders yet.": "Noch keine Bestellungen.", "Online": "Online", "Offline": "Offline", "Approve": "Genehmigen", "Reject": "Ablehnen", "Dashboard": "Dashboard", "Refresh": "Aktualisieren",
      "Incoming VASI voice call": "Eingehender VASI-Sprachanruf", "Your ride partner is calling inside VASI.": "Ihr Fahrtpartner ruft in VASI an.", "Enable phone alerts": "Telefonbenachrichtigungen aktivieren", "Alerts enabled": "Benachrichtigungen aktiviert", "Updates": "Updates", "Mark all read": "Alle als gelesen markieren", "Test phone alert": "Telefonbenachrichtigung testen", "Check notifications on this device": "Benachrichtigungen auf diesem Gerät prüfen", "VASI test successful": "VASI-Test erfolgreich", "Phone alerts work on this device. Keep VASI installed for ride updates.": "Telefonbenachrichtigungen funktionieren. Lassen Sie VASI für Fahrtupdates installiert."
    },
    ar: {
      "Driver": "السائق", "Ride partner": "شريك الرحلة", "Ride chat": "محادثة الرحلة", "Chat with your driver": "محادثة مع السائق", "Chat with your customer": "محادثة مع العميل", "Live chat & calls": "محادثة ومكالمات مباشرة", "Voice call": "مكالمة صوتية", "Start voice call": "بدء مكالمة صوتية", "Incoming voice call": "مكالمة صوتية واردة", "Calling": "جارٍ الاتصال بـ", "is calling": "يتصل بك", "Joining": "جارٍ الاتصال بـ", "Starting microphone…": "تشغيل الميكروفون…", "Waiting for an answer": "في انتظار الرد", "Connected": "متصل", "Reconnecting…": "إعادة الاتصال…", "Decline": "رفض", "Answer": "رد", "Mute": "كتم", "Unmute": "إلغاء الكتم", "End call": "إنهاء المكالمة", "Call declined": "تم رفض المكالمة", "Call ended": "انتهت المكالمة", "No answer": "لا توجد إجابة", "Call connection failed. Please try again.": "فشل اتصال المكالمة. حاول مجددًا.", "Voice calls are not supported by this browser.": "المكالمات الصوتية غير مدعومة في هذا المتصفح.", "Allow microphone access in your phone settings, then try again.": "اسمح بالوصول إلى الميكروفون من إعدادات الهاتف.", "The microphone could not be started. Please try again.": "تعذر تشغيل الميكروفون. حاول مجددًا.", "Chat · Voice call": "محادثة · مكالمة صوتية",
      "Resend SMS code": "إعادة إرسال رمز SMS", "Requesting new code…": "طلب رمز جديد…", "Checking your code…": "التحقق من الرمز…", "Enter the most recently received 6-digit SMS code.": "أدخل أحدث رمز SMS مكوّن من 6 أرقام.", "This SMS code has expired or was already used. Tap Resend SMS code for a new code.": "انتهت صلاحية الرمز أو تم استخدامه. اطلب رمزًا جديدًا.", "The SMS code is incorrect. Check the newest message and try again.": "رمز SMS غير صحيح. تحقق من أحدث رسالة.",
      "Drive with VASI": "قد مع VASI", "Go online": "الاتصال", "ONLINE": "متصل", "OFFLINE": "غير متصل", "Verified driver": "سائق موثّق", "Verification required": "التحقق مطلوب", "Current ride": "الرحلة الحالية", "No active ride": "لا توجد رحلة نشطة", "Ride requests": "طلبات الرحلات", "No new ride requests.": "لا توجد طلبات جديدة.", "Accept ride": "قبول الرحلة", "Start Ride": "بدء الرحلة", "Complete Ride": "إكمال الرحلة", "Open navigation to pickup": "فتح الملاحة إلى موقع الانطلاق", "Arrived at Pickup": "وصلت إلى موقع الانطلاق", "Food orders": "طلبات الطعام", "Deliveries": "التوصيلات", "Connect Stripe": "ربط Stripe", "Sign out": "تسجيل الخروج",
      "Grow your restaurant.": "نمِّ مطعمك.", "Join VASI": "انضم إلى VASI", "Partner dashboard": "لوحة الشريك", "Restaurant name": "اسم المطعم", "Business email": "بريد العمل", "Restaurant address": "عنوان المطعم", "Submit for VASI approval": "إرسال لموافقة VASI", "Menu": "القائمة", "Orders": "الطلبات", "Add item": "إضافة صنف", "No menu items yet.": "لا توجد أصناف بعد.", "No orders yet.": "لا توجد طلبات بعد.", "Online": "متصل", "Offline": "غير متصل", "Approve": "موافقة", "Reject": "رفض", "Dashboard": "لوحة التحكم", "Refresh": "تحديث",
      "Incoming VASI voice call": "مكالمة VASI واردة", "Your ride partner is calling inside VASI.": "شريك الرحلة يتصل بك داخل VASI.", "Enable phone alerts": "تفعيل تنبيهات الهاتف", "Alerts enabled": "التنبيهات مفعلة", "Updates": "التحديثات", "Mark all read": "تعليم الكل كمقروء", "Test phone alert": "اختبار تنبيه الهاتف", "Check notifications on this device": "تحقق من الإشعارات على هذا الجهاز", "VASI test successful": "نجح اختبار VASI", "Phone alerts work on this device. Keep VASI installed for ride updates.": "تنبيهات الهاتف تعمل على هذا الجهاز. أبقِ VASI مثبتًا لتحديثات الرحلة."
    },
    hi: {
      "Driver": "ड्राइवर", "Ride partner": "राइड साथी", "Ride chat": "राइड चैट", "Chat with your driver": "ड्राइवर से चैट", "Chat with your customer": "ग्राहक से चैट", "Live chat & calls": "लाइव चैट और कॉल", "Voice call": "वॉइस कॉल", "Start voice call": "वॉइस कॉल शुरू करें", "Incoming voice call": "आने वाली वॉइस कॉल", "Calling": "कॉल की जा रही है", "is calling": "कॉल कर रहे हैं", "Joining": "कनेक्ट हो रहा है", "Starting microphone…": "माइक्रोफ़ोन शुरू हो रहा है…", "Waiting for an answer": "जवाब की प्रतीक्षा", "Connected": "कनेक्टेड", "Reconnecting…": "फिर से कनेक्ट हो रहा है…", "Decline": "अस्वीकार", "Answer": "जवाब दें", "Mute": "म्यूट", "Unmute": "अनम्यूट", "End call": "कॉल समाप्त करें", "Call declined": "कॉल अस्वीकार हुई", "Call ended": "कॉल समाप्त", "No answer": "कोई जवाब नहीं", "Call connection failed. Please try again.": "कॉल कनेक्शन विफल रहा। फिर प्रयास करें।", "Voice calls are not supported by this browser.": "यह ब्राउज़र वॉइस कॉल का समर्थन नहीं करता।", "Allow microphone access in your phone settings, then try again.": "फ़ोन सेटिंग में माइक्रोफ़ोन अनुमति दें।", "The microphone could not be started. Please try again.": "माइक्रोफ़ोन शुरू नहीं हो सका।", "Chat · Voice call": "चैट · वॉइस कॉल",
      "Resend SMS code": "SMS कोड फिर भेजें", "Requesting new code…": "नया कोड माँगा जा रहा है…"…16383 tokens truncated… pickup location": "Destination confirmée — choisissez maintenant votre lieu de départ",
    "Start typing an address or place — VASI will suggest matches": "Commencez à saisir une adresse ou un lieu — VASI vous proposera des résultats",
    "Confirming the selected Google address…": "Confirmation de l’adresse Google sélectionnée…",
    "Finding destination…": "Recherche de la destination…",
    "AI corrected the destination search — check the map pin": "L’IA a corrigé la recherche de destination — vérifiez le repère sur la carte",
    "Calculating route…": "Calcul de l’itinéraire…",
    "Finding stop…": "Recherche de l’arrêt…",
    "Creating your VASI ride…": "Création de votre trajet VASI…",
    "Airport pickup needs the flight arrival date and time": "La prise en charge à l’aéroport nécessite la date et l’heure d’arrivée du vol",
    "Enter the arriving flight number, for example AF1234": "Saisissez le numéro du vol à l’arrivée, par exemple AF1234",
    "Enter a valid flight number, for example AF1234": "Saisissez un numéro de vol valide, par exemple AF1234",
    "Preparing secure payment…": "Préparation du paiement sécurisé…",
    "Card, Apple Pay and Google Pay are coming soon": "Le paiement par carte, Apple Pay et Google Pay sera bientôt disponible",
    "Authorizing…": "Autorisation…",
    "Cancel ride · Free": "Annuler le trajet · Gratuit",
    "Finding a VASI driver…": "Recherche d’un chauffeur VASI…",
    "Driver assigned · waiting for acceptance": "Chauffeur attribué · en attente d’acceptation",
    "Driver accepted · on the way": "Chauffeur accepté · en route",
    "Driver arrived — waiting for you": "Le chauffeur est arrivé — il vous attend",
    "Rate driver & view receipt": "Noter le chauffeur et voir le reçu",
    "Your VASI rides and receipts.": "Vos trajets VASI et vos reçus.",
    "Loading rides…": "Chargement des trajets…",
    "VASI Ride Chat": "Chat du trajet VASI",
    "Ride chat": "Chat du trajet",
    "Loading your ride…": "Chargement de votre trajet…",
    "Connecting…": "Connexion…",
    "Loading messages…": "Chargement des messages…",
    "Send": "Envoyer",
    "Voice call": "Appel vocal",
    "Decline": "Refuser",
    "Answer": "Répondre",
    "Mute": "Couper le micro",
    "End call": "Terminer l’appel",
    "Approved local restaurants, live menus and protected delivery.": "Restaurants locaux approuvés, menus à jour et livraison protégée.",
    "Search restaurants, dishes or allergens": "Rechercher un restaurant, un plat ou un allergène",
    "Own a restaurant?": "Vous gérez un restaurant ?",
    "Join VASI": "Rejoindre VASI",
    "Partner dashboard": "Tableau de bord partenaire",
    "Loading partner restaurants…": "Chargement des restaurants partenaires…",
    "Your basket": "Votre panier",
    "Group": "Groupe",
    "View basket →": "Voir le panier →",
    "VASI Food Checkout": "Paiement VASI Food",
    "Checkout": "Paiement",
    "Your price and courier protection are calculated securely.": "Votre prix et la protection du livreur sont calculés de manière sécurisée.",
    "Subtotal": "Sous-total",
    "Service fee": "Frais de service",
    "Total": "Total",
    "If an item is unavailable": "Si un article est indisponible",
    "Refund that item": "Rembourser cet article",
    "Replace with a similar item": "Remplacer par un article similaire",
    "Contact me before changing": "Me contacter avant toute modification",
    "Delivery time": "Heure de livraison",
    "As soon as possible": "Dès que possible",
    "Schedule this order": "Planifier cette commande",
    "Continue to secure payment": "Continuer vers le paiement sécurisé",
    "🔒 Card payment is processed securely by Stripe. The courier is paid only after your delivery PIN.": "🔒 Le paiement par carte est traité de manière sécurisée par Stripe. Le livreur est payé uniquement après la saisie de votre PIN de livraison.",
    "Pay now": "Payer maintenant",
    "Checking basket…": "Vérification du panier…",
    "Choose the scheduled delivery date and time": "Choisissez la date et l’heure de livraison",
    "Scheduled order must be at least 30 minutes from now": "La commande planifiée doit être prévue au moins 30 minutes à l’avance",
    "Scheduled order must be within 7 days": "La commande planifiée doit être prévue dans les 7 prochains jours",
    "Payment service unavailable": "Service de paiement indisponible",
    "Could not price basket": "Impossible de calculer le prix du panier",
    "VASI Food Group Order": "Commande groupée VASI Food",
    "Order together.": "Commandez ensemble.",
    "Everyone adds their own items. The host reviews one combined basket and pays once.": "Chacun ajoute ses articles. L’organisateur vérifie le panier commun et paie une seule fois.",
    "Opening invitation…": "Ouverture de l’invitation…",
    "Add my items to the group": "Ajouter mes articles au groupe",
    "Share invitation link": "Partager le lien d’invitation",
    "Close group & checkout": "Fermer le groupe et payer",
    "Your name": "Votre nom",
    "Group order unavailable": "Commande groupée indisponible",
    "Group order": "Commande groupée",
    "Choose at least one item.": "Choisissez au moins un article.",
    "Your items are in the group basket.": "Vos articles sont dans le panier du groupe.",
    "Join my VASI Food order": "Rejoignez ma commande VASI Food",
    "Invitation link copied.": "Lien d’invitation copié.",
    "Close the group so no more items can be added?": "Fermer le groupe afin qu’aucun autre article ne puisse être ajouté ?",
    "Restaurant is currently unavailable": "Le restaurant est actuellement indisponible",
    "Invitation active for 24 hours.": "Invitation active pendant 24 heures.",
    "The group basket is closed.": "Le panier du groupe est fermé.",
    "Drop-off": "Destination",
    "Small & medium": "Petits et moyens colis",
    "Fast & secure": "Rapide et sécurisé",
    "Enter pickup and drop-off to continue.": "Saisissez le départ et la destination pour continuer.",
    "VASI Live Trip": "Trajet VASI en direct",
    "Live trip": "Trajet en direct",
    "A VASI customer shared this private trip link with you.": "Un client VASI a partagé avec vous ce lien de trajet privé.",
    "Waiting for trip details…": "En attente des détails du trajet…",
    "Finding a driver": "Recherche d’un chauffeur",
    "Driver is on the way": "Le chauffeur est en route",
    "Driver has arrived": "Le chauffeur est arrivé",
    "Trip link unavailable": "Lien de trajet indisponible",
    "A driver has not been assigned yet": "Aucun chauffeur n’a encore été attribué",
    "VASI driver · live location": "Chauffeur VASI · position en direct",
    "Invalid trip link": "Lien de trajet invalide",
    "VASI Safety Centre": "Centre de sécurité VASI",
    "Emergency help, ride-start PIN, and a private live trip link in one place.": "Aide d’urgence, PIN de début de trajet et lien privé de suivi au même endroit.",
    "Emergency assistance": "Assistance d’urgence",
    "If you or someone else is in immediate danger in France or the EU, call 112.": "Si vous ou une autre personne êtes en danger immédiat en France ou dans l’UE, appelez le 112.",
    "Call emergency services · 112": "Appeler les secours · 112",
    "Ride-start PIN": "PIN de début de trajet",
    "Give this PIN to your driver only after you are inside the correct vehicle.": "Donnez ce PIN au chauffeur uniquement lorsque vous êtes installé dans le bon véhicule.",
    "Share live trip": "Partager le trajet en direct",
    "Share an unlisted link with someone you trust. Your phone number and email are never shown.": "Partagez un lien privé avec une personne de confiance. Votre numéro de téléphone et votre e-mail ne sont jamais affichés.",
    "Stop sharing": "Arrêter le partage",
    "Loading ride…": "Chargement du trajet…",
    "Private trip link copied": "Lien privé du trajet copié",
    "Could not share trip": "Impossible de partager le trajet",
    "Stop this live trip link?": "Arrêter ce lien de suivi en direct ?",
    "Could not stop sharing": "Impossible d’arrêter le partage",
    "Live trip sharing stopped": "Partage du trajet en direct arrêté",
    "Invalid ride link": "Lien de trajet invalide",
    "VASI Support": "Assistance VASI",
    "24/7 help": "Aide 24 h/24 et 7 j/7",
    "Tamil · English · French. For immediate danger call": "Tamoul · anglais · français. En cas de danger immédiat, appelez",
    "Ride driver": "Chauffeur de trajet",
    "Food order": "Commande de repas",
    "Payment / refund": "Paiement / remboursement",
    "Account / login": "Compte / connexion",
    "Restaurant partner": "Restaurant partenaire",
    "Send to VASI Support": "Envoyer à l’assistance VASI",
    "Support email": "E-mail de l’assistance VASI",
    "Contact us:": "Nous contacter :",
    "Your support tickets": "Vos demandes d’assistance",
    "Support unavailable": "Assistance indisponible",
    "Delete VASI account": "Supprimer le compte VASI",
    "Account & privacy": "Compte et confidentialité",
    "Delete your account": "Supprimer votre compte",
    "You can start account deletion here. We will verify and process the request within 30 days.": "Vous pouvez demander ici la suppression de votre compte. Nous vérifierons et traiterons la demande sous 30 jours.",
    "Before you continue": "Avant de continuer",
    "You will be signed out after the request is submitted.": "Vous serez déconnecté après l’envoi de la demande.",
    "Active rides, orders, payments or safety cases may need to finish first.": "Les trajets, commandes, paiements ou dossiers de sécurité en cours devront peut-être être terminés au préalable.",
    "VASI may retain limited transaction, fraud-prevention, tax or legal records for the required period.": "VASI peut conserver certaines données de transaction, de prévention de la fraude, fiscales ou légales pendant la durée requise.",
    "You can contact support before processing finishes if you submitted the request by mistake.": "Vous pouvez contacter l’assistance avant la fin du traitement si vous avez envoyé la demande par erreur.",
    "Confirm deletion request": "Confirmer la demande de suppression",
    "Reason (optional)": "Motif (facultatif)",
    "Type DELETE": "Saisissez DELETE",
    "This prevents an accidental request.": "Cela évite une demande accidentelle.",
    "I understand that deletion is irreversible after VASI finishes processing it.": "Je comprends que la suppression est irréversible une fois le traitement terminé par VASI.",
    "Request account deletion": "Demander la suppression du compte",
    "Sign in to verify your account": "Connectez-vous pour vérifier votre compte",
    "VASI uses your verified phone login before accepting a deletion request.": "VASI utilise votre connexion téléphonique vérifiée avant d’accepter une demande de suppression.",
    "Sign in with phone number": "Se connecter avec le numéro de téléphone",
    "Submit your VASI account deletion request?": "Envoyer votre demande de suppression du compte VASI ?",
    "Submitting your secure request…": "Envoi de votre demande sécurisée…",
    "A deletion request is already active for this account.": "Une demande de suppression est déjà active pour ce compte.",
    "We could not submit the request. Please try again or contact VASI Support.": "Impossible d’envoyer la demande. Réessayez ou contactez l’assistance VASI.",
    "Request received. Signing you out…": "Demande reçue. Déconnexion…",
    "VASI BUSINESS": "VASI BUSINESS",
    "Company travel, together.": "Les déplacements professionnels, réunis.",
    "Tag company rides, use cost-centre references and create one monthly ride statement.": "Identifiez les trajets professionnels, utilisez des références de centre de coûts et créez un relevé mensuel unique.",
    "Create a business account": "Créer un compte professionnel",
    "Create VASI Business account": "Créer un compte VASI Business",
    "COMPANY": "ENTREPRISE",
    "Book company ride": "Réserver un trajet professionnel",
    "Completed rides": "Trajets terminés",
    "Ride total": "Total des trajets",
    "Statements": "Relevés",
    "Monthly invoice": "Facture mensuelle",
    "Choose a month to consolidate completed company rides. This statement does not add VAT until VASI's tax registration and invoicing configuration are active.": "Choisissez un mois pour regrouper les trajets professionnels terminés. Ce relevé n’ajoute pas la TVA tant que l’immatriculation fiscale et la facturation de VASI ne sont pas activées.",
    "Generate monthly statement": "Générer le relevé mensuel",
    "Monthly statement generated.": "Relevé mensuel généré.",
    "company rides": "trajets professionnels",
    "Print / save PDF": "Imprimer / enregistrer en PDF",
    "No monthly statements yet.": "Aucun relevé mensuel pour le moment.",
    "VASI partner registration": "Inscription partenaire VASI",
    "Become a VASI partner": "Devenir partenaire VASI",
    "Create a separate account for driving or delivery work.": "Créez un compte séparé pour votre activité de chauffeur ou de livreur.",
    "Choose your activity": "Choisissez votre activité",
    "VTC driver": "Chauffeur VTC",
    "Passenger transport": "Transport de passagers",
    "Food + Delivery courier": "VASI Food + Livraison",
    "Identity": "Identité",
    "Operating country": "Pays d’activité",
    "Address": "Adresse",
    "Identity document": "Pièce d’identité",
    "Profile photo": "Photo de profil",
    "Optional": "Facultatif",
    "Vehicle and documents": "Véhicule et documents",
    "Bicycle": "Vélo",
    "E-bike · 25 km/h max.": "VAE · 25 km/h max.",
    "Scooter": "Scooter",
    "Motorcycle": "Moto",
    "Car": "Voiture",
    "No driving licence required": "Aucun permis de conduire requis",
    "For a compliant bicycle or e-bike (assistance up to 25 km/h): no licence, registration certificate or vehicle insurance upload is required. A faster motorised cycle must be registered as a scooter/motorcycle.": "Pour un vélo ou un VAE conforme (assistance jusqu’à 25 km/h) : pas de permis, carte grise ou assurance véhicule à télécharger. Un cycle motorisé plus rapide doit être inscrit en scooter/moto.",
    "Motor vehicle": "Véhicule motorisé",
    "A driving licence, insurance, registration certificate and transport documents are required.": "Le permis, l’assurance, la carte grise et les justificatifs de transport sont obligatoires.",
    "VTC professional card": "Carte professionnelle VTC",
    "Driving licence": "Permis de conduire",
    "Private hire vehicle licence": "Licence de véhicule de transport avec chauffeur",
    "Business registration": "SIREN / KBIS / RNE",
    "Professional insurance": "Assurance professionnelle",
    "Vehicle registration certificate": "Carte grise",
    "UK private hire licensing": "Licences VTC au Royaume-Uni",
    "The driver, vehicle and operator must have the licences required by the same local licensing authority. London applications are handled by TfL.": "Le chauffeur, le véhicule et l’exploitant doivent disposer des licences exigées par la même autorité locale. À Londres, les demandes sont gérées par TfL.",
    "Proof of self-employment in France.": "Preuve de votre activité indépendante en France.",
    "Insulated delivery bag photo": "Photo du sac isotherme",
    "Bicycle photo": "Photo du vélo",
    "Vehicle insurance": "Assurance du véhicule",
    "Light goods transport capacity / licence": "Capacité / licence de transport léger",
    "Bank account and payouts": "Compte bancaire et versements",
    "You add your bank account yourself": "Vous ajoutez vous-même votre RIB",
    "After VASI approves your documents, open the Driver or Courier app and tap “Connect my bank account (RIB)”. You will enter your IBAN on Stripe’s secure page. VASI does not store your full IBAN.": "Après validation de vos documents par VASI, ouvrez l’application Chauffeur ou Livreur et touchez « Connecter mon compte bancaire (RIB) ». Vous saisirez votre IBAN sur la page sécurisée de Stripe. VASI ne stocke pas votre IBAN complet.",
    "Live verification": "Vérification en direct",
    "Take a live selfie to confirm the account belongs to you.": "Prenez un selfie en direct pour confirmer que le compte vous appartient.",
    "Take selfie": "Prendre le selfie",
    "I accept identity verification and secure processing of my documents by VASI.": "J’accepte la vérification d’identité et le traitement sécurisé de mes documents par VASI.",
    "Required documents must be approved by a VASI administrator before going online.": "Les documents obligatoires doivent être validés par un administrateur VASI avant la mise en ligne.",
    "Submit for approval": "Envoyer pour validation",
    "VASI Driver": "Chauffeur VASI",
    "Log out": "Déconnexion",
    "Offline": "Hors ligne",
    "GPS off": "GPS désactivé",
    "Go online": "Se mettre en ligne",
    "Verified VASI ride drivers can go online and receive nearby ride requests.": "Les chauffeurs VASI vérifiés peuvent se mettre en ligne et recevoir les demandes de trajet à proximité.",
    "Driver tools": "Outils chauffeur",
    "This month": "Ce mois-ci",
    "Trips": "Trajets",
    "Download monthly earnings CSV": "Télécharger les revenus mensuels en CSV",
    "Vehicles & passenger needs": "Véhicules et besoins des passagers",
    "Wheelchair-accessible": "Accessible en fauteuil roulant",
    "Child seat available": "Siège enfant disponible",
    "Pet-friendly": "Animaux acceptés",
    "Save service options": "Enregistrer les options de service",
    "Busy areas": "Zones très demandées",
    "Demand is rounded to neighbourhood zones to protect customer privacy.": "La demande est regroupée par quartier afin de protéger la vie privée des clients.",
    "Checking nearby demand…": "Vérification de la demande à proximité…",
    "Bank payouts": "Versements bancaires",
    "Card-ride earnings are paid automatically to your RIB every Monday after Stripe makes the funds available.": "Les revenus des trajets payés par carte sont versés automatiquement sur votre RIB chaque lundi après leur mise à disposition par Stripe.",
    "Cash rides are paid directly by the passenger and are not included in the bank payout.": "Les trajets en espèces sont payés directement par le passager et ne sont pas inclus dans le versement bancaire.",
    "Checking cash-ride commission balance…": "Vérification du solde de commission des trajets en espèces…",
    "Service options saved.": "Options de service enregistrées.",
    "Gross fare": "Prix brut",
    "OFFLINE": "HORS LIGNE",
    "Drive with VASI": "Conduisez avec VASI",
    "Sign in to receive rides, food and delivery jobs.": "Connectez-vous pour recevoir des trajets, commandes de repas et livraisons.",
    "Send sign-in link": "Envoyer le lien de connexion",
    "Checking…": "Vérification…",
    "Rating": "Note",
    "Connect Stripe to receive card-ride payouts.": "Connectez Stripe pour recevoir les versements des trajets payés par carte.",
    "Connect Stripe": "Connecter Stripe",
    "Current ride": "Trajet en cours",
    "No active ride": "Aucun trajet en cours",
    "Food orders": "Commandes de repas",
    "Go online to receive food orders.": "Mettez-vous en ligne pour recevoir des commandes de repas.",
    "Deliveries": "Livraisons",
    "Go online to receive delivery jobs.": "Mettez-vous en ligne pour recevoir des livraisons.",
    "Ride requests": "Demandes de trajet",
    "Go online to receive requests.": "Mettez-vous en ligne pour recevoir des demandes.",
    "Enter your email": "Saisissez votre e-mail",
    "Check your email.": "Consultez votre e-mail.",
    "Driver profile required": "Profil chauffeur requis",
    "Final fare (€)": "Prix final (€)",
    "Invalid fare": "Prix invalide",
    "Food order accepted": "Commande de repas acceptée",
    "Delivery accepted": "Livraison acceptée",
    "Driver country code (FR or GB)": "Code pays du chauffeur (FR ou GB)",
    "Stripe onboarding failed": "Échec de l’activation Stripe",
    "VASI Courier": "Livreur VASI",
    "COURIER · FOOD + DELIVERY": "LIVREUR · FOOD + LIVRAISON",
    "Checking courier account…": "Vérification du compte livreur…",
    "Courier status": "Statut du livreur",
    "Checking payout account…": "Vérification du compte de versement…",
    "Go online to see courier jobs.": "Mettez-vous en ligne pour voir les livraisons disponibles.",
    "Verification pending": "Vérification en attente",
    "RIB verified · delivery earnings are paid automatically every Monday.": "RIB vérifié · les revenus de livraison sont versés automatiquement chaque lundi.",
    "Connect and verify your bank account (RIB) before your first delivery.": "Connectez et vérifiez votre compte bancaire (RIB) avant votre première livraison.",
    "Enter PIN · Complete delivery": "Saisir le PIN · Terminer la livraison",
    "Food picked up": "Repas récupéré",
    "Complete delivery": "Terminer la livraison",
    "Parcel picked up": "Colis récupéré",
    "Delivery completed.": "Livraison terminée.",
    "Join VASI · Restaurant": "Rejoindre VASI · Restaurant",
    "Restaurant partners": "Partenaires restaurants",
    "Join VASI.": "Rejoignez VASI.",
    "Create your restaurant account, register your establishment, then add your menu after approval.": "Créez votre compte restaurateur, enregistrez votre établissement puis ajoutez votre menu après validation.",
    "Simple restaurant commission · 10%": "Commission restaurant simple · 10 %",
    "One rate of 10% on ordered items, regardless of delivery service · €0 setup fee.": "Un taux unique de 10 % sur les articles commandés, quel que soit le service de livraison · 0 € de frais d’installation.",
    "Restaurant owner account": "Compte restaurateur",
    "Enter your email. We will send you a secure link to create your account or sign in.": "Entrez votre e-mail. Nous vous enverrons un lien sécurisé pour créer votre compte ou vous connecter.",
    "Owner email": "E-mail du propriétaire",
    "Create my restaurant account": "Créer mon compte restaurant",
    "or": "ou",
    "Continue with my phone number": "Continuer avec mon numéro de téléphone",
    "SMS lets you continue immediately if your email is delayed.": "Le SMS permet de continuer immédiatement si votre e-mail tarde à arriver.",
    "Use another account": "Utiliser un autre compte",
    "Your restaurant": "Votre restaurant",
    "Complete the business information. The VASI team will review it before you go live.": "Complétez les informations professionnelles. L’équipe VASI les vérifiera avant la mise en ligne.",
    "Restaurant name": "Nom du restaurant",
    "Legal business name": "Raison sociale",
    "Cuisine type": "Type de cuisine",
    "Business email": "E-mail professionnel",
    "Restaurant address": "Adresse du restaurant",
    "Delivery service": "Service de livraison",
    "VASI courier · 10%": "Coursier VASI · 10 %",
    "My own team · 10%": "Ma propre équipe · 10 %",
    "After VASI approval, you will connect your own bank account (RIB) from the restaurant dashboard. The IBAN is entered on Stripe's secure page and is never stored in full by VASI.": "Après validation VASI, vous connecterez vous-même votre compte bancaire (RIB) depuis le tableau de bord restaurant. L’IBAN est saisi sur la page sécurisée de Stripe et n’est jamais enregistré intégralement par VASI.",
    "Submit for VASI approval": "Envoyer pour validation VASI",
    "Your information is used only to verify and manage your VASI restaurant partnership.": "Vos informations servent uniquement à vérifier et gérer votre partenariat restaurant VASI.",
    "Restaurant dashboard · VASI": "Tableau de bord restaurant · VASI",
    "Partner": "Partenaire",
    "Loading restaurant…": "Chargement du restaurant…",
    "Payout status unavailable": "Statut des versements indisponible",
    "RIB verified · restaurant earnings are paid automatically every Monday.": "RIB vérifié · les revenus du restaurant sont versés automatiquement chaque lundi.",
    "Preparing and checking food photo…": "Préparation et vérification de la photo du plat…",
    "Saved.": "Enregistré."
  };
  const finalFrenchTranslations = {
    "Settings · VASI": "Paramètres · VASI",
    "💬 Chat · 📞 Voice call": "💬 Chat · 📞 Appel vocal",
    "items ·": "articles ·",
    "Enter a valid": "Saisissez un",
    "mobile number, for example": "numéro de mobile valide, par exemple",
    "Customer profile": "Profil client",
    "Choose an image file.": "Choisissez un fichier image.",
    "Choose a photo smaller than 10 MB.": "Choisissez une photo de moins de 10 Mo.",
    "This photo could not be prepared.": "Cette photo n’a pas pu être préparée.",
    "This photo could not be compressed below 2 MB.": "Cette photo n’a pas pu être compressée en dessous de 2 Mo.",
    "✓ Profile ready": "✓ Profil complet",
    "Scheduled order confirmed": "Commande planifiée confirmée",
    "Flight number": "Numéro de vol",
    "Company cost centre / reference (optional)": "Centre de coûts / référence de l’entreprise (facultatif)",
    "UK launch pricing": "Tarifs de lancement au Royaume-Uni",
    "Finding pickup…": "Recherche du lieu de départ…",
    "Driver assigned": "Chauffeur attribué",
    "Searching nearby drivers": "Recherche de chauffeurs à proximité",
    "sfood": "places",
    "Saving your rating…": "Enregistrement de votre note…",
    "Add an item before starting a group order.": "Ajoutez un article avant de démarrer une commande groupée.",
    "Creating your group ordering link…": "Création de votre lien de commande groupée…",
    "Could not create group order": "Impossible de créer la commande groupée",
    "Driver is at pickup": "Le chauffeur est au lieu de départ",
    "Ride unavailable": "Trajet indisponible",
    "My VASI trip": "Mon trajet VASI",
    "Follow my VASI trip live": "Suivez mon trajet VASI en direct",
    "Tell us what happened": "Expliquez-nous ce qui s’est passé",
    "Company legal name": "Raison sociale",
    "Billing email": "E-mail de facturation",
    "Billing address": "Adresse de facturation",
    "VASI operating country": "Pays d’activité VASI",
    "Private hire driver licence": "Licence de chauffeur VTC",
    "UK driving licence": "Permis de conduire britannique",
    "Sole trader or company registration": "Immatriculation d’indépendant ou de société",
    "Private hire insurance": "Assurance VTC",
    "V5C vehicle logbook": "Certificat d’immatriculation V5C",
    "Self-employment or company proof": "Justificatif d’activité indépendante ou de société",
    "Proof that you may work as a self-employed courier in the UK.": "Justificatif vous autorisant à travailler comme livreur indépendant au Royaume-Uni.",
    "Submission failed:": "Envoi impossible :",
    "Stripe onboarding needs to be completed. Tap the button to continue.": "L’activation Stripe doit être terminée. Touchez le bouton pour continuer.",
    "Driver email": "E-mail du chauffeur",
    "VASI Go": "VASI Go",
    "RIB verified · delivery earnings are paid automatically every Monday.": "RIB vérifié · les revenus de livraison sont versés automatiquement chaque lundi.",
    "No Food jobs right now.": "Aucune livraison Food disponible actuellement.",
    "No Delivery jobs right now.": "Aucune livraison de colis disponible actuellement.",
    "✓ Delivery completed.": "✓ Livraison terminée.",
    "Company number / UTR": "Numéro d’entreprise / UTR",
    "Enter a valid email address.": "Saisissez une adresse e-mail valide.",
    "RIB verified · restaurant earnings are paid automatically every Monday.": "RIB vérifié · les revenus du restaurant sont versés automatiquement chaque lundi."
  };
  Object.assign(finalFrenchTranslations, {
    "Edit": "Modifier",
    "Not added": "Non renseigné",
    "Country and currency": "Pays et devise",
    "Allow location access or tap the map to select your pickup. No price is calculated until pickup is confirmed.": "Autorisez la localisation ou touchez la carte pour choisir votre point de départ. Aucun prix n’est calculé tant que le départ n’est pas confirmé.",
    "Airport pickup": "Prise en charge à l’aéroport",
    "Passengers": "Passagers",
    "Passenger": "Passager",
    "passenger": "passager",
    "passengers": "passagers",
    "Luggage": "Bagages",
    "luggage": "bagages",
    "Arrival terminal (optional)": "Terminal d’arrivée (facultatif)",
    "Pickup zone or meeting point (optional)": "Zone de prise en charge ou point de rencontre (facultatif)",
    "Choose the expected arrival time. VASI tracks your flight, adjusts pickup automatically and shows the official terminal details when available.": "Choisissez l’heure d’arrivée prévue. VASI suit votre vol, ajuste automatiquement la prise en charge et affiche les informations officielles du terminal lorsqu’elles sont disponibles.",
    "I’m ready for pickup": "Je suis prêt pour la prise en charge",
    "Notifying your driver…": "Notification de votre chauffeur…",
    "Driver notified — you’re ready": "Chauffeur informé — vous êtes prêt",
    "Your driver knows you are ready at the pickup point": "Votre chauffeur sait que vous êtes prêt au point de prise en charge",
    "Could not notify the driver": "Impossible d’informer le chauffeur",
    "Passenger is ready at the pickup point": "Le passager est prêt au point de prise en charge",
    "Waiting for the passenger’s ready signal": "En attente du signal du passager",
    "Pickup:": "Prise en charge :",
    "selected for your passengers and luggage": "sélectionné pour vos passagers et vos bagages",
    "Open terminal map": "Ouvrir le plan du terminal",
    "Select your terminal": "Sélectionnez votre terminal",
    "Airport not detected. Enter your terminal and confirm the meeting point with the driver.": "Aéroport non détecté. Saisissez votre terminal et confirmez le point de rencontre avec le chauffeur.",
    "The live flight terminal will automatically replace your selection when available.": "Le terminal suivi du vol remplacera automatiquement votre sélection lorsqu’il sera disponible.",
    "Choose your arrival terminal": "Choisissez votre terminal d’arrivée",
    "No activity yet.": "Aucune activité pour le moment.",
    "No ride activity yet.": "Aucun trajet pour le moment.",
    "No Food activity yet.": "Aucune commande Food pour le moment.",
    "No delivery activity yet.": "Aucune livraison pour le moment."
  });
  Object.assign(translations.fr, dynamicFrenchTranslations, supplementalFrenchTranslations, finalFrenchTranslations);

  const rideMapTranslations = {
    fr: {
      "Type an address or use current location": "Saisissez une adresse ou utilisez votre position actuelle",
      "Enter pickup address or place": "Saisir l’adresse ou le lieu de départ",
      "Pickup suggestions": "Suggestions de lieux de départ",
      "Confirm the pickup pin": "Confirmer le repère de départ",
      "Drag the pickup pin if needed, then confirm it.": "Déplacez le repère de départ si nécessaire, puis confirmez-le.",
      "Confirm pickup": "Confirmer le départ",
      "Select pickup location": "Sélectionner le lieu de départ",
      "Pickup selected on map": "Départ sélectionné sur la carte",
      "Current location": "Position actuelle",
      "Pickup selected": "Départ sélectionné",
      "Type a pickup address, use current location or tap the map": "Saisissez une adresse de départ, utilisez votre position actuelle ou touchez la carte",
      "Confirming the selected pickup address…": "Confirmation de l’adresse de départ sélectionnée…",
      "Destination selected — confirm your pickup": "Destination sélectionnée — confirmez votre départ",
      "Destination selected — now choose your pickup": "Destination sélectionnée — choisissez maintenant votre lieu de départ",
      "AI corrected the pickup search — check the map pin": "L’IA a corrigé la recherche du lieu de départ — vérifiez le repère sur la carte",
      "Pickup not found — try the postcode and city": "Lieu de départ introuvable — essayez avec le code postal et la ville",
      "Destination not found — try the postcode and city": "Destination introuvable — essayez avec le code postal et la ville",
      "Check the pickup pin, then confirm it": "Vérifiez le repère de départ, puis confirmez-le",
      "Pickup confirmed — now choose your destination": "Départ confirmé — choisissez maintenant votre destination",
      "Pin moved — confirm this pickup before pricing": "Repère déplacé — confirmez ce départ avant le calcul du prix",
      "Confirm both map pins before booking": "Confirmez les deux repères sur la carte avant de commander",
      "Confirm pickup spot": "Confirmez le lieu de départ",
      "Confirm destination spot": "Confirmez le lieu de destination",
      "Drag map to move pin": "Déplacez la carte pour ajuster le repère",
      "Edit pickup address": "Modifier l’adresse de départ",
      "Edit destination address": "Modifier l’adresse de destination",
      "Finding address…": "Recherche de l’adresse…",
      "Selected map location": "Emplacement sélectionné sur la carte"
    },
    ta: {
      "Type an address or use current location": "முகவரியை உள்ளிடவும் அல்லது தற்போதைய இருப்பிடத்தைப் பயன்படுத்தவும்",
      "Enter pickup address or place": "புறப்படும் முகவரி அல்லது இடத்தை உள்ளிடவும்",
      "Pickup suggestions": "புறப்படும் இடப் பரிந்துரைகள்",
      "Confirm the pickup pin": "புறப்படும் இடக் குறியை உறுதிப்படுத்துங்கள்",
      "Drag the pickup pin if needed, then confirm it.": "தேவையெனில் புறப்படும் இடக் குறியை நகர்த்தி உறுதிப்படுத்துங்கள்.",
      "Confirm pickup": "புறப்படும் இடத்தை உறுதிப்படுத்துங்கள்",
      "Select pickup location": "புறப்படும் இடத்தைத் தேர்ந்தெடுக்கவும்",
      "Pickup selected on map": "வரைபடத்தில் புறப்படும் இடம் தேர்ந்தெடுக்கப்பட்டது",
      "Current location": "தற்போதைய இருப்பிடம்",
      "Pickup selected": "புறப்படும் இடம் தேர்ந்தெடுக்கப்பட்டது",
      "Type a pickup address, use current location or tap the map": "புறப்படும் முகவரியை உள்ளிடுங்கள், தற்போதைய இருப்பிடத்தைப் பயன்படுத்துங்கள் அல்லது வரைபடத்தைத் தொடுங்கள்",
      "Confirming the selected pickup address…": "தேர்ந்தெடுத்த புறப்படும் முகவரி உறுதிப்படுத்தப்படுகிறது…",
      "Destination selected — confirm your pickup": "செல்லும் இடம் தேர்ந்தெடுக்கப்பட்டது — புறப்படும் இடத்தை உறுதிப்படுத்துங்கள்",
      "Destination selected — now choose your pickup": "செல்லும் இடம் தேர்ந்தெடுக்கப்பட்டது — இப்போது புறப்படும் இடத்தைத் தேர்ந்தெடுக்கவும்",
      "AI corrected the pickup search — check the map pin": "AI புறப்படும் இடத் தேடலைத் திருத்தியது — வரைபடக் குறியைச் சரிபாருங்கள்",
      "Pickup not found — try the postcode and city": "புறப்படும் இடம் கிடைக்கவில்லை — அஞ்சல் குறியீடும் நகரமும் சேர்த்து முயற்சிக்கவும்",
      "Destination not found — try the postcode and city": "செல்லும் இடம் கிடைக்கவில்லை — அஞ்சல் குறியீடும் நகரமும் சேர்த்து முயற்சிக்கவும்",
      "Check the pickup pin, then confirm it": "புறப்படும் இடக் குறியைச் சரிபார்த்து உறுதிப்படுத்துங்கள்",
      "Pickup confirmed — now choose your destination": "புறப்படும் இடம் உறுதி செய்யப்பட்டது — இப்போது செல்லும் இடத்தைத் தேர்ந்தெடுக்கவும்",
      "Pin moved — confirm this pickup before pricing": "இடக் குறி நகர்த்தப்பட்டது — கட்டணம் கணக்கிடும் முன் புறப்படும் இடத்தை உறுதிப்படுத்துங்கள்",
      "Confirm both map pins before booking": "பயணத்தைப் பதிவு செய்வதற்கு முன் இரண்டு வரைபடக் குறிகளையும் உறுதிப்படுத்துங்கள்",
      "Confirm pickup spot": "புறப்படும் இடத்தை உறுதிப்படுத்துங்கள்",
      "Confirm destination spot": "செல்லும் இடத்தை உறுதிப்படுத்துங்கள்",
      "Drag map to move pin": "இடக் குறியை நகர்த்த வரைபடத்தை இழுக்கவும்",
      "Edit pickup address": "புறப்படும் முகவரியை மாற்றவும்",
      "Edit destination address": "செல்லும் முகவரியை மாற்றவும்",
      "Finding address…": "முகவரி தேடப்படுகிறது…",
      "Selected map location": "வரைபடத்தில் தேர்ந்தெடுத்த இடம்"
    },
    de: {
      "Type an address or use current location": "Adresse eingeben oder aktuellen Standort verwenden",
      "Enter pickup address or place": "Abholadresse oder Ort eingeben",
      "Pickup suggestions": "Vorschläge für die Abholung",
      "Confirm the pickup pin": "Abholpunkt bestätigen",
      "Drag the pickup pin if needed, then confirm it.": "Verschieben Sie den Abholpunkt bei Bedarf und bestätigen Sie ihn.",
      "Confirm pickup": "Abholung bestätigen",
      "Select pickup location": "Abholort auswählen",
      "Pickup selected on map": "Abholung auf der Karte ausgewählt",
      "Current location": "Aktueller Standort",
      "Pickup selected": "Abholung ausgewählt",
      "Type a pickup address, use current location or tap the map": "Abholadresse eingeben, aktuellen Standort verwenden oder auf die Karte tippen",
      "Confirming the selected pickup address…": "Ausgewählte Abholadresse wird bestätigt…",
      "Destination selected — confirm your pickup": "Ziel ausgewählt — bestätigen Sie Ihre Abholung",
      "Destination selected — now choose your pickup": "Ziel ausgewählt — wählen Sie jetzt Ihren Abholort",
      "AI corrected the pickup search — check the map pin": "Die KI hat die Abholsuche korrigiert — prüfen Sie den Kartenpunkt",
      "Pickup not found — try the postcode and city": "Abholort nicht gefunden — versuchen Sie es mit Postleitzahl und Stadt",
      "Destination not found — try the postcode and city": "Ziel nicht gefunden — versuchen Sie es mit Postleitzahl und Stadt",
      "Check the pickup pin, then confirm it": "Abholpunkt prüfen und bestätigen",
      "Pickup confirmed — now choose your destination": "Abholung bestätigt — wählen Sie jetzt Ihr Ziel",
      "Pin moved — confirm this pickup before pricing": "Punkt verschoben — bestätigen Sie die Abholung vor der Preisberechnung",
      "Confirm both map pins before booking": "Bestätigen Sie vor der Buchung beide Kartenpunkte",
      "Confirm pickup spot": "Abholort bestätigen",
      "Confirm destination spot": "Zielort bestätigen",
      "Drag map to move pin": "Karte verschieben, um den Punkt anzupassen",
      "Edit pickup address": "Abholadresse bearbeiten",
      "Edit destination address": "Zieladresse bearbeiten",
      "Finding address…": "Adresse wird gesucht…",
      "Selected map location": "Ausgewählter Kartenort"
    },
    ar: {
      "Type an address or use current location": "أدخل عنوانًا أو استخدم موقعك الحالي",
      "Enter pickup address or place": "أدخل عنوان أو مكان الانطلاق",
      "Pickup suggestions": "اقتراحات موقع الانطلاق",
      "Confirm the pickup pin": "تأكيد علامة موقع الانطلاق",
      "Drag the pickup pin if needed, then confirm it.": "حرّك علامة موقع الانطلاق عند الحاجة، ثم أكدها.",
      "Confirm pickup": "تأكيد موقع الانطلاق",
      "Select pickup location": "اختر موقع الانطلاق",
      "Pickup selected on map": "تم اختيار موقع الانطلاق على الخريطة",
      "Current location": "الموقع الحالي",
      "Pickup selected": "تم اختيار موقع الانطلاق",
      "Type a pickup address, use current location or tap the map": "أدخل عنوان الانطلاق أو استخدم موقعك الحالي أو اضغط على الخريطة",
      "Confirming the selected pickup address…": "جارٍ تأكيد عنوان الانطلاق المحدد…",
      "Destination selected — confirm your pickup": "تم اختيار الوجهة — أكّد موقع الانطلاق",
      "Destination selected — now choose your pickup": "تم اختيار الوجهة — اختر الآن موقع الانطلاق",
      "AI corrected the pickup search — check the map pin": "صحح الذكاء الاصطناعي بحث موقع الانطلاق — تحقق من العلامة على الخريطة",
      "Pickup not found — try the postcode and city": "تعذر العثور على موقع الانطلاق — جرّب الرمز البريدي والمدينة",
      "Destination not found — try the postcode and city": "تعذر العثور على الوجهة — جرّب الرمز البريدي والمدينة",
      "Check the pickup pin, then confirm it": "تحقق من علامة موقع الانطلاق ثم أكدها",
      "Pickup confirmed — now choose your destination": "تم تأكيد موقع الانطلاق — اختر وجهتك الآن",
      "Pin moved — confirm this pickup before pricing": "تم تحريك العلامة — أكد موقع الانطلاق قبل حساب السعر",
      "Confirm both map pins before booking": "أكد علامتي الخريطة قبل الحجز",
      "Confirm pickup spot": "تأكيد موقع الانطلاق",
      "Confirm destination spot": "تأكيد موقع الوجهة",
      "Drag map to move pin": "اسحب الخريطة لتحريك العلامة",
      "Edit pickup address": "تعديل عنوان الانطلاق",
      "Edit destination address": "تعديل عنوان الوجهة",
      "Finding address…": "جارٍ البحث عن العنوان…",
      "Selected map location": "الموقع المحدد على الخريطة"
    },
    hi: {
      "Type an address or use current location": "पता दर्ज करें या वर्तमान स्थान का उपयोग करें",
      "Enter pickup address or place": "पिकअप पता या स्थान दर्ज करें",
      "Pickup suggestions": "पिकअप स्थान के सुझाव",
      "Confirm the pickup pin": "पिकअप पिन की पुष्टि करें",
      "Drag the pickup pin if needed, then confirm it.": "ज़रूरत हो तो पिकअप पिन खींचें, फिर पुष्टि करें।",
      "Confirm pickup": "पिकअप की पुष्टि करें",
      "Select pickup location": "पिकअप स्थान चुनें",
      "Pickup selected on map": "मानचित्र पर पिकअप चुना गया",
      "Current location": "वर्तमान स्थान",
      "Pickup selected": "पिकअप चुना गया",
      "Type a pickup address, use current location or tap the map": "पिकअप पता दर्ज करें, वर्तमान स्थान का उपयोग करें या मानचित्र पर टैप करें",
      "Confirming the selected pickup address…": "चुने गए पिकअप पते की पुष्टि की जा रही है…",
      "Destination selected — confirm your pickup": "गंतव्य चुना गया — अपने पिकअप की पुष्टि करें",
      "Destination selected — now choose your pickup": "गंतव्य चुना गया — अब अपना पिकअप स्थान चुनें",
      "AI corrected the pickup search — check the map pin": "AI ने पिकअप खोज ठीक की — मानचित्र पिन जाँचें",
      "Pickup not found — try the postcode and city": "पिकअप नहीं मिला — डाक कोड और शहर के साथ प्रयास करें",
      "Destination not found — try the postcode and city": "गंतव्य नहीं मिला — डाक कोड और शहर के साथ प्रयास करें",
      "Check the pickup pin, then confirm it": "पिकअप पिन जाँचें और पुष्टि करें",
      "Pickup confirmed — now choose your destination": "पिकअप की पुष्टि हो गई — अब अपना गंतव्य चुनें",
      "Pin moved — confirm this pickup before pricing": "पिन बदला गया — कीमत देखने से पहले पिकअप की पुष्टि करें",
      "Confirm both map pins before booking": "बुकिंग से पहले मानचित्र के दोनों पिन की पुष्टि करें",
      "Confirm pickup spot": "पिकअप स्थान की पुष्टि करें",
      "Confirm destination spot": "गंतव्य स्थान की पुष्टि करें",
      "Drag map to move pin": "पिन को बदलने के लिए मानचित्र खींचें",
      "Edit pickup address": "पिकअप पता बदलें",
      "Edit destination address": "गंतव्य पता बदलें",
      "Finding address…": "पता खोजा जा रहा है…",
      "Selected map location": "मानचित्र पर चुना गया स्थान"
    }
  };
  Object.entries(rideMapTranslations).forEach(([code, values]) => Object.assign(translations[code], values));

  Object.assign(translations.fr, {"Meals & groceries.": "Repas et courses.", "Restaurants, grocery shops and supermarkets, delivered to you.": "Restaurants, épiceries et supermarchés, livrés chez vous.", "Search shop, meal or grocery product…": "Rechercher un commerce, un plat ou un produit…", "All shops": "Tous les commerces", "Grocery shop": "Épicerie", "Supermarket": "Supermarché", "All categories": "Toutes les catégories", "No matching products found.": "Aucun produit correspondant.", "Try another product, shop or category.": "Essayez un autre produit, commerce ou catégorie.", "No partner shops are available yet.": "Aucun commerce partenaire n’est encore disponible.", "Approved restaurants and shops will appear when their catalogs are ready.": "Les restaurants et commerces validés apparaîtront dès que leurs catalogues seront prêts.", "Product details": "Détails du produit", "Fruit and vegetables": "Fruits et légumes", "Dairy products": "Produits laitiers", "Bread and pastries": "Pain et pâtisserie", "Meat and fish": "Viandes et poissons", "Savory groceries": "Épicerie salée", "Sweet groceries": "Épicerie sucrée", "Drinks": "Boissons", "Frozen products": "Surgelés", "Hygiene and household": "Hygiène et entretien"});
  Object.assign(translations.ta, {"Meals & groceries.": "உணவும் மளிகைப் பொருட்களும்.", "All shops": "அனைத்துக் கடைகளும்", "Grocery shop": "மளிகைக் கடை", "Supermarket": "பல்பொருள் அங்காடி", "All categories": "அனைத்து வகைகளும்", "No matching products found.": "பொருத்தமான பொருட்கள் இல்லை.", "Search shop, meal or grocery product…": "கடை, உணவு அல்லது மளிகைப் பொருள் தேடுங்கள்…"});

  Object.assign(translations.fr, {"Restaurant & Market login":"Connexion Restaurant & Market", "Manage your restaurant or market, products and orders.":"Gérez votre restaurant ou market, vos produits et vos commandes."});
  Object.assign(translations.ta, {"Restaurant & Market login":"Restaurant & Market உள்நுழைவு", "Manage your restaurant or market, products and orders.":"உங்கள் உணவகம் அல்லது கடை, பொருட்கள் மற்றும் ஆர்டர்களை நிர்வகிக்கவும்."});
  Object.assign(translations.fr, {"Manage your restaurant & market.":"Pilotez votre restaurant & market.","Sign in to my shop":"Se connecter à mon commerce","Register a restaurant or market":"Inscrire un restaurant ou market","Catalog":"Catalogue"});
  // Every page does not currently use the same source language: most customer
  // pages start in English, while a few partner/admin pages start in French.
  // Build a reverse index so either source can always be normalized back to
  // the canonical English key before rendering the selected language.
  const canonicalByLanguage = {};
  const phraseSet = new Set();
  SUPPORTED.filter((code) => code !== "en").forEach((code) => {
    const reverse = new Map();
    Object.entries(translations[code] || {}).forEach(([source, localized]) => {
      if (!reverse.has(source)) reverse.set(source, source);
      if (localized && !reverse.has(localized)) reverse.set(localized, source);
      phraseSet.add(source);
      if (localized) phraseSet.add(localized);
    });
    canonicalByLanguage[code] = reverse;
  });
  const knownPhrases = Array.from(phraseSet).sort((a, b) => b.length - a.length);

  const textState = new WeakMap();
  const attributeState = new WeakMap();
  const translatableAttributes = ["placeholder", "aria-label", "title", "alt"];
  const translationCache = new Map();
  let language = readLanguage();

  function readLanguage() {
    try {
      if (localStorage.getItem(DEFAULT_POLICY_KEY) !== DEFAULT_POLICY_VERSION) {
        localStorage.setItem(STORAGE_KEY, DEFAULT_LANGUAGE);
        localStorage.setItem(DEFAULT_POLICY_KEY, DEFAULT_POLICY_VERSION);
        return DEFAULT_LANGUAGE;
      }
      const stored = localStorage.getItem(STORAGE_KEY);
      return SUPPORTED.includes(stored) ? stored : DEFAULT_LANGUAGE;
    } catch (_) {
      return DEFAULT_LANGUAGE;
    }
  }

  function canonicalSource(source) {
    if (Object.values(translations).some((values) => Object.hasOwn(values, source))) return source;
    const preferred = language === "en"
      ? [DEFAULT_LANGUAGE, ...SUPPORTED.filter((code) => code !== "en" && code !== DEFAULT_LANGUAGE)]
      : [language, ...SUPPORTED.filter((code) => code !== "en" && code !== language)];
    for (const code of preferred) {
      const canonical = canonicalByLanguage[code]?.get(source);
      if (canonical) return canonical;
    }
    return source;
  }

  function translateExact(source) {
    const canonical = canonicalSource(source);
    if (language === "en") return canonical;
    return translations[language]?.[canonical] || canonical;
  }

  function decorationsOnly(value) {
    return /^[\p{P}\p{S}\p{Z}\p{M}\d]*$/u.test(value);
  }

  function replaceBoundedPhrase(value, phrase, replacement) {
    let cursor = 0;
    let output = "";
    let changed = false;
    const word = (character) => character ? /[\p{L}\p{N}]/u.test(character) : false;
    while (cursor < value.length) {
      const index = value.indexOf(phrase, cursor);
      if (index < 0) {
        output += value.slice(cursor);
        break;
      }
      const before = index > 0 ? value[index - 1] : "";
      const afterIndex = index + phrase.length;
      const after = afterIndex < value.length ? value[afterIndex] : "";
      const startIsWord = word(phrase[0]);
      const endIsWord = word(phrase[phrase.length - 1]);
      if ((!startIsWord || !word(before)) && (!endIsWord || !word(after))) {
        output += value.slice(cursor, index) + replacement;
        cursor = afterIndex;
        changed = true;
      } else {
        output += value.slice(cursor, index + phrase.length);
        cursor = index + phrase.length;
      }
    }
    return changed ? output : value;
  }

  function translateComposite(source) {
    let rendered = source;
    for (const phrase of knownPhrases) {
      if (phrase.length < 4 || !/[\p{L}\p{N}]/u.test(phrase)) continue;
      const localized = translateExact(phrase);
      if (!localized || localized === phrase) continue;
      rendered = replaceBoundedPhrase(rendered, phrase, localized);
    }
    return rendered;
  }

  function translate(source) {
    const cacheKey = `${language}\u0000${source}`;
    if (translationCache.has(cacheKey)) return translationCache.get(cacheKey);
    let rendered = translateExact(source);

    // Translate labels wrapped in UI symbols, for example "🚗 Ride",
    // "← Retour" and "Account →", without touching user-provided content.
    if (rendered === source) {
      for (const phrase of knownPhrases) {
        if (source.length <= phrase.length) continue;
        const start = source.indexOf(phrase);
        if (start >= 0 && decorationsOnly(source.slice(0, start)) && decorationsOnly(source.slice(start + phrase.length))) {
          rendered = source.slice(0, start) + translateExact(phrase) + source.slice(start + phrase.length);
          break;
        }
      }
    }

    if (rendered === source) rendered = translateComposite(source);

    translationCache.set(cacheKey, rendered);
    return rendered;
  }

  function translateTextNode(node) {
    const parent = node.parentElement;
    if (!parent || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/.test(parent.tagName)) return;
    if (parent.closest("[data-vasi-no-translate]")) return;
    const raw = node.nodeValue || "";
    const current = raw.trim();
    if (!current) return;
    let state = textState.get(node);
    if (!state || current !== state.rendered) state = { source: current, rendered: current };
    const rendered = translate(state.source);
    if (current !== rendered) {
      const leading = raw.match(/^\s*/)?.[0] || "";
      const trailing = raw.match(/\s*$/)?.[0] || "";
      node.nodeValue = leading + rendered + trailing;
    }
    state.rendered = rendered;
    textState.set(node, state);
  }

  function translateAttributes(element) {
    if (!(element instanceof Element) || element.closest("[data-vasi-no-translate]")) return;
    let states = attributeState.get(element) || {};
    translatableAttributes.forEach((attribute) => {
      if (!element.hasAttribute(attribute)) return;
      const current = element.getAttribute(attribute) || "";
      let state = states[attribute];
      if (!state || current !== state.rendered) state = { source: current, rendered: current };
      const rendered = translate(state.source);
      if (current !== rendered) element.setAttribute(attribute, rendered);
      state.rendered = rendered;
      states[attribute] = state;
    });
    attributeState.set(element, states);
  }

  function translateTree(root) {
    if (root.nodeType === Node.TEXT_NODE) {
      translateTextNode(root);
      return;
    }
    if (!(root instanceof Element) && root !== document) return;
    if (root instanceof Element) translateAttributes(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) translateTextNode(node);
      else translateAttributes(node);
      node = walker.nextNode();
    }
  }

  function applyDocument() {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.body?.classList.toggle("vasi-rtl", language === "ar");
    translateTree(document);
  }

  function setLanguage(next) {
    if (!SUPPORTED.includes(next)) return false;
    language = next;
    translationCache.clear();
    try { localStorage.setItem(STORAGE_KEY, next); } catch (_) {}
    applyDocument();
    window.dispatchEvent(new CustomEvent("vasi:languagechange", { detail: { language: next } }));
    return true;
  }

  function init() {
    if (document.body?.hasAttribute("data-vasi-business")) return;
    const style = document.createElement("style");
    style.textContent = "html[dir='rtl'] input[type='tel'],html[dir='rtl'] input[inputmode='numeric'],html[dir='rtl'] .price{direction:ltr}html[dir='rtl'] input[type='tel'],html[dir='rtl'] input[inputmode='numeric']{text-align:right}";
    document.head.appendChild(style);
    applyDocument();
    new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "characterData") translateTextNode(mutation.target);
        mutation.addedNodes.forEach(translateTree);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  window.VasiLanguage = {
    supported: SUPPORTED.slice(),
    labels: { ...LABELS },
    getLanguage: () => language,
    setLanguage,
    apply: applyDocument,
    translate: (source) => translate(String(source)),
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
