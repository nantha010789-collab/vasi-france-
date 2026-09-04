(function () {
  "use strict";

  const STORAGE_KEY = "vasi_language";
  const DEFAULT_LANGUAGE = "fr";
  const SUPPORTED = ["fr", "en", "ta", "de", "ar", "hi"];
  const LABELS = {
    fr: "Français",
    en: "English",
    ta: "தமிழ்",
    de: "Deutsch",
    ar: "العربية",
    hi: "हिन्दी",
  };

  const translations = {
    fr: {
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
      "One VASI app for rides, food and delivery.": "Une seule application VASI pour les trajets, les repas et les livraisons.",
      "Ride": "Trajet",
      "Fast city trips": "Trajets rapides en ville",
      "Eats": "Repas",
      "Food delivery": "Livraison de repas",
      "Delivery": "Livraison",
      "Send anything": "Envoyez vos colis",
      "Services": "Services",
      "3 ready": "3 services disponibles",
      "France & Europe": "France et Europe",
      "Book a ride": "Commander un trajet",
      "Driver app": "Application chauffeur",
      "AI Customer Service": "Service client IA",
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
      "Eats + Delivery courier account.": "Compte livreur Eats et Livraison.",
      "Manage your restaurant, menu and VASI Eats orders.": "Gérez votre restaurant, votre menu et vos commandes VASI Eats.",
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
      "Ride, Eats & Delivery": "Trajets, Repas et Livraisons",
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
      "First customer ride only; every Eats delivery": "Premier trajet client uniquement ; chaque livraison Eats",
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
      "Food, your way.": "Vos repas, à votre façon.",
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
    },
    ta: {
      "Home": "முகப்பு", "Back": "பின்செல்", "Account": "கணக்கு", "Activity": "செயல்பாடுகள்", "Login": "உள்நுழைவு", "Settings": "அமைப்புகள்", "Language": "மொழி", "App display language": "செயலி காட்சி மொழி",
      "Europe mobility platform": "ஐரோப்பிய போக்குவரத்து தளம்", "Move.": "பயணம்.", "Eat.": "உணவு.", "Deliver.": "டெலிவரி.", "One VASI app for rides, food and delivery.": "பயணம், உணவு மற்றும் டெலிவரிக்கு ஒரே VASI செயலி.",
      "Ride": "பயணம்", "Fast city trips": "விரைவான நகரப் பயணங்கள்", "Eats": "உணவு", "Food delivery": "உணவு டெலிவரி", "Delivery": "டெலிவரி", "Send anything": "பொருட்களை அனுப்புங்கள்", "Services": "சேவைகள்", "3 ready": "3 சேவைகள் தயார்", "France & Europe": "பிரான்ஸ் மற்றும் ஐரோப்பா", "Book a ride": "பயணம் பதிவு செய்யுங்கள்", "Driver app": "ஓட்டுநர் செயலி", "AI Customer Service": "AI வாடிக்கையாளர் சேவை",
      "Customer": "வாடிக்கையாளர்", "Courier": "டெலிவரி பணியாளர்", "Restaurant": "உணவகம்", "Customer login": "வாடிக்கையாளர் உள்நுழைவு", "Ride Driver login": "ஓட்டுநர் உள்நுழைவு", "Courier login": "டெலிவரி பணியாளர் உள்நுழைவு", "Restaurant owner login": "உணவக உரிமையாளர் உள்நுழைவு",
      "Enter your mobile number. We will send a 6-digit SMS code.": "உங்கள் மொபைல் எண்ணை உள்ளிடுங்கள். 6 இலக்க SMS குறியீட்டை அனுப்புவோம்.", "Send SMS code": "SMS குறியீட்டை அனுப்பவும்", "6-digit SMS code": "6 இலக்க SMS குறியீடு", "Verify & continue": "சரிபார்த்து தொடரவும்", "Change phone number": "தொலைபேசி எண்ணை மாற்றவும்", "Continue": "தொடரவும்", "Cancel": "ரத்து", "Close": "மூடு", "Save": "சேமிக்கவும்",
      "Your VASI account": "உங்கள் VASI கணக்கு", "Manage alerts, privacy, security, safety and app preferences.": "அறிவிப்புகள், தனியுரிமை, பாதுகாப்பு மற்றும் செயலி விருப்பங்களை நிர்வகிக்கவும்.", "Notifications": "அறிவிப்புகள்", "Alert preferences": "அறிவிப்பு விருப்பங்கள்", "Notification history": "அறிவிப்பு வரலாறு", "Privacy": "தனியுரிமை", "Location access": "இருப்பிட அனுமதி", "Phone-number privacy": "தொலைபேசி எண் தனியுரிமை", "Offers & marketing": "சலுகைகள் மற்றும் விளம்பரம்", "Download my data": "என் தரவைப் பதிவிறக்கவும்", "Delete account": "கணக்கை நீக்கவும்", "Security": "பாதுகாப்பு", "SMS verification": "SMS சரிபார்ப்பு", "This device": "இந்த சாதனம்", "Active session": "செயலில் உள்ள அமர்வு", "Signed in": "உள்நுழைந்துள்ளது", "Sign out all devices": "அனைத்து சாதனங்களிலிருந்தும் வெளியேறவும்", "Safety": "பாதுகாப்பு", "Safety Centre": "பாதுகாப்பு மையம்", "Safety PIN": "பாதுகாப்பு PIN", "Protected": "பாதுகாக்கப்பட்டது", "App preferences": "செயலி விருப்பங்கள்", "Reduce motion": "அசைவைக் குறைக்கவும்", "Country & currency": "நாடு மற்றும் நாணயம்",
      "Plan your ride": "பயணத்தை திட்டமிடுங்கள்", "Choose your ride": "பயணத்தை தேர்வு செய்யுங்கள்", "Confirm ride": "பயணத்தை உறுதிப்படுத்துங்கள்", "Add stop": "நிறுத்தம் சேர்க்கவும்", "Payment": "கட்டணம்", "Cash": "பணம்", "Card": "அட்டை", "Reserve": "முன்பதிவு", "Now": "இப்போது", "Destination": "செல்லும் இடம்", "Pickup": "புறப்படும் இடம்", "Food, your way.": "உங்கள் விருப்பப்படி உணவு.", "Search restaurant or food…": "உணவகம் அல்லது உணவைத் தேடுங்கள்…", "Cart": "கூடை", "Add": "சேர்க்கவும்", "Send anything.": "எதையும் அனுப்புங்கள்.", "Full pickup address": "முழு பிக்கப் முகவரி", "Full destination address": "முழு சேருமிட முகவரி", "Parcel": "பார்சல்", "Document": "ஆவணம்", "Estimated delivery": "மதிப்பிடப்பட்ட டெலிவரி", "Get delivery quote": "டெலிவரி விலையைப் பெறவும்", "Book VASI delivery": "VASI டெலிவரியை பதிவு செய்யவும்",
    },
    de: {
      "Home": "Startseite", "Back": "Zurück", "Account": "Konto", "Activity": "Aktivität", "Login": "Anmelden", "Settings": "Einstellungen", "Language": "Sprache", "App display language": "Anzeigesprache der App",
      "Europe mobility platform": "Europäische Mobilitätsplattform", "Move.": "Fahren.", "Eat.": "Essen.", "Deliver.": "Liefern.", "One VASI app for rides, food and delivery.": "Eine VASI-App für Fahrten, Essen und Lieferungen.",
      "Ride": "Fahrt", "Fast city trips": "Schnelle Stadtfahrten", "Eats": "Essen", "Food delivery": "Essenslieferung", "Delivery": "Lieferung", "Send anything": "Alles versenden", "Services": "Dienste", "3 ready": "3 Dienste bereit", "France & Europe": "Frankreich und Europa", "Book a ride": "Fahrt buchen", "Driver app": "Fahrer-App", "AI Customer Service": "KI-Kundenservice",
      "Customer": "Kunde", "Courier": "Kurier", "Restaurant": "Restaurant", "Customer login": "Kundenanmeldung", "Ride Driver login": "Fahreranmeldung", "Courier login": "Kurier-Anmeldung", "Restaurant owner login": "Restaurant-Anmeldung", "Enter your mobile number. We will send a 6-digit SMS code.": "Geben Sie Ihre Mobilnummer ein. Wir senden einen 6-stelligen SMS-Code.", "Send SMS code": "SMS-Code senden", "6-digit SMS code": "6-stelliger SMS-Code", "Verify & continue": "Prüfen und fortfahren", "Change phone number": "Telefonnummer ändern", "Continue": "Weiter", "Cancel": "Abbrechen", "Close": "Schließen", "Save": "Speichern",
      "Your VASI account": "Ihr VASI-Konto", "Notifications": "Benachrichtigungen", "Alert preferences": "Benachrichtigungseinstellungen", "Notification history": "Benachrichtigungsverlauf", "Privacy": "Datenschutz", "Location access": "Standortzugriff", "Phone-number privacy": "Telefonnummer schützen", "Offers & marketing": "Angebote und Marketing", "Download my data": "Meine Daten herunterladen", "Delete account": "Konto löschen", "Security": "Sicherheit", "SMS verification": "SMS-Bestätigung", "This device": "Dieses Gerät", "Active session": "Aktive Sitzung", "Signed in": "Angemeldet", "Sign out all devices": "Auf allen Geräten abmelden", "Safety": "Sicherheit", "Safety Centre": "Sicherheitscenter", "Safety PIN": "Sicherheits-PIN", "Protected": "Geschützt", "App preferences": "App-Einstellungen", "Reduce motion": "Bewegung reduzieren", "Country & currency": "Land und Währung",
      "Plan your ride": "Fahrt planen", "Choose your ride": "Fahrt auswählen", "Confirm ride": "Fahrt bestätigen", "Add stop": "Stopp hinzufügen", "Payment": "Zahlung", "Cash": "Bargeld", "Card": "Karte", "Reserve": "Reservieren", "Now": "Jetzt", "Destination": "Ziel", "Pickup": "Abholung", "Food, your way.": "Essen nach Ihrem Geschmack.", "Search restaurant or food…": "Restaurant oder Essen suchen…", "Cart": "Warenkorb", "Add": "Hinzufügen", "Send anything.": "Alles versenden.", "Full pickup address": "Vollständige Abholadresse", "Full destination address": "Vollständige Zieladresse", "Parcel": "Paket", "Document": "Dokument", "Estimated delivery": "Geschätzte Lieferung", "Get delivery quote": "Lieferpreis berechnen", "Book VASI delivery": "VASI-Lieferung buchen",
    },
    ar: {
      "Home": "الرئيسية", "Back": "رجوع", "Account": "الحساب", "Activity": "النشاط", "Login": "تسجيل الدخول", "Settings": "الإعدادات", "Language": "اللغة", "App display language": "لغة عرض التطبيق",
      "Europe mobility platform": "منصة التنقل الأوروبية", "Move.": "تنقّل.", "Eat.": "اطلب الطعام.", "Deliver.": "أرسل.", "One VASI app for rides, food and delivery.": "تطبيق VASI واحد للرحلات والطعام والتوصيل.",
      "Ride": "رحلة", "Fast city trips": "رحلات سريعة داخل المدينة", "Eats": "الطعام", "Food delivery": "توصيل الطعام", "Delivery": "التوصيل", "Send anything": "أرسل أي شيء", "Services": "الخدمات", "3 ready": "3 خدمات جاهزة", "France & Europe": "فرنسا وأوروبا", "Book a ride": "احجز رحلة", "Driver app": "تطبيق السائق", "AI Customer Service": "خدمة العملاء بالذكاء الاصطناعي",
      "Customer": "العميل", "Courier": "مندوب التوصيل", "Restaurant": "المطعم", "Customer login": "دخول العميل", "Ride Driver login": "دخول السائق", "Courier login": "دخول مندوب التوصيل", "Restaurant owner login": "دخول صاحب المطعم", "Enter your mobile number. We will send a 6-digit SMS code.": "أدخل رقم هاتفك المحمول. سنرسل رمزاً من 6 أرقام عبر SMS.", "Send SMS code": "إرسال رمز SMS", "6-digit SMS code": "رمز SMS من 6 أرقام", "Verify & continue": "تحقق وتابع", "Change phone number": "تغيير رقم الهاتف", "Continue": "متابعة", "Cancel": "إلغاء", "Close": "إغلاق", "Save": "حفظ",
      "Your VASI account": "حساب VASI الخاص بك", "Notifications": "الإشعارات", "Alert preferences": "تفضيلات التنبيه", "Notification history": "سجل الإشعارات", "Privacy": "الخصوصية", "Location access": "الوصول إلى الموقع", "Phone-number privacy": "خصوصية رقم الهاتف", "Offers & marketing": "العروض والتسويق", "Download my data": "تنزيل بياناتي", "Delete account": "حذف الحساب", "Security": "الأمان", "SMS verification": "التحقق عبر SMS", "This device": "هذا الجهاز", "Active session": "جلسة نشطة", "Signed in": "تم تسجيل الدخول", "Sign out all devices": "تسجيل الخروج من جميع الأجهزة", "Safety": "السلامة", "Safety Centre": "مركز السلامة", "Safety PIN": "رمز PIN للسلامة", "Protected": "محمي", "App preferences": "تفضيلات التطبيق", "Reduce motion": "تقليل الحركة", "Country & currency": "البلد والعملة",
      "Plan your ride": "خطط لرحلتك", "Choose your ride": "اختر رحلتك", "Confirm ride": "تأكيد الرحلة", "Add stop": "إضافة محطة", "Payment": "الدفع", "Cash": "نقداً", "Card": "بطاقة", "Reserve": "حجز", "Now": "الآن", "Destination": "الوجهة", "Pickup": "موقع الانطلاق", "Food, your way.": "طعامك كما تحب.", "Search restaurant or food…": "ابحث عن مطعم أو طعام…", "Cart": "السلة", "Add": "إضافة", "Send anything.": "أرسل أي شيء.", "Full pickup address": "عنوان الاستلام الكامل", "Full destination address": "عنوان الوجهة الكامل", "Parcel": "طرد", "Document": "مستند", "Estimated delivery": "التوصيل المتوقع", "Get delivery quote": "احصل على سعر التوصيل", "Book VASI delivery": "احجز توصيل VASI",
    },
    hi: {
      "Home": "होम", "Back": "वापस", "Account": "खाता", "Activity": "गतिविधि", "Login": "लॉग इन", "Settings": "सेटिंग्स", "Language": "भाषा", "App display language": "ऐप की भाषा",
      "Europe mobility platform": "यूरोप मोबिलिटी प्लेटफ़ॉर्म", "Move.": "यात्रा.", "Eat.": "खाना.", "Deliver.": "डिलीवरी.", "One VASI app for rides, food and delivery.": "राइड, खाना और डिलीवरी के लिए एक VASI ऐप.",
      "Ride": "राइड", "Fast city trips": "तेज़ शहर यात्राएँ", "Eats": "खाना", "Food delivery": "खाने की डिलीवरी", "Delivery": "डिलीवरी", "Send anything": "कुछ भी भेजें", "Services": "सेवाएँ", "3 ready": "3 सेवाएँ तैयार", "France & Europe": "फ़्रांस और यूरोप", "Book a ride": "राइड बुक करें", "Driver app": "ड्राइवर ऐप", "AI Customer Service": "AI ग्राहक सेवा",
      "Customer": "ग्राहक", "Courier": "कूरियर", "Restaurant": "रेस्टोरेंट", "Customer login": "ग्राहक लॉग इन", "Ride Driver login": "ड्राइवर लॉग इन", "Courier login": "कूरियर लॉग इन", "Restaurant owner login": "रेस्टोरेंट मालिक लॉग इन", "Enter your mobile number. We will send a 6-digit SMS code.": "अपना मोबाइल नंबर डालें। हम 6 अंकों का SMS कोड भेजेंगे।", "Send SMS code": "SMS कोड भेजें", "6-digit SMS code": "6 अंकों का SMS कोड", "Verify & continue": "सत्यापित करें और आगे बढ़ें", "Change phone number": "फ़ोन नंबर बदलें", "Continue": "आगे बढ़ें", "Cancel": "रद्द करें", "Close": "बंद करें", "Save": "सेव करें",
      "Your VASI account": "आपका VASI खाता", "Notifications": "सूचनाएँ", "Alert preferences": "सूचना प्राथमिकताएँ", "Notification history": "सूचना इतिहास", "Privacy": "गोपनीयता", "Location access": "लोकेशन अनुमति", "Phone-number privacy": "फ़ोन नंबर गोपनीयता", "Offers & marketing": "ऑफ़र और मार्केटिंग", "Download my data": "मेरा डेटा डाउनलोड करें", "Delete account": "खाता हटाएँ", "Security": "सुरक्षा", "SMS verification": "SMS सत्यापन", "This device": "यह डिवाइस", "Active session": "सक्रिय सत्र", "Signed in": "लॉग इन है", "Sign out all devices": "सभी डिवाइस से लॉग आउट करें", "Safety": "सुरक्षा", "Safety Centre": "सुरक्षा केंद्र", "Safety PIN": "सुरक्षा PIN", "Protected": "सुरक्षित", "App preferences": "ऐप प्राथमिकताएँ", "Reduce motion": "एनीमेशन कम करें", "Country & currency": "देश और मुद्रा",
      "Plan your ride": "अपनी राइड की योजना बनाएँ", "Choose your ride": "अपनी राइड चुनें", "Confirm ride": "राइड की पुष्टि करें", "Add stop": "स्टॉप जोड़ें", "Payment": "भुगतान", "Cash": "नकद", "Card": "कार्ड", "Reserve": "आरक्षित करें", "Now": "अभी", "Destination": "मंज़िल", "Pickup": "पिकअप", "Food, your way.": "खाना, आपकी पसंद का.", "Search restaurant or food…": "रेस्टोरेंट या खाना खोजें…", "Cart": "कार्ट", "Add": "जोड़ें", "Send anything.": "कुछ भी भेजें.", "Full pickup address": "पूरा पिकअप पता", "Full destination address": "मंज़िल का पूरा पता", "Parcel": "पार्सल", "Document": "दस्तावेज़", "Estimated delivery": "अनुमानित डिलीवरी", "Get delivery quote": "डिलीवरी कीमत देखें", "Book VASI delivery": "VASI डिलीवरी बुक करें",
    },
  };

  const textState = new WeakMap();
  const attributeState = new WeakMap();
  const translatableAttributes = ["placeholder", "aria-label", "title"];
  let language = readLanguage();

  function readLanguage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return SUPPORTED.includes(stored) ? stored : DEFAULT_LANGUAGE;
    } catch (_) {
      return DEFAULT_LANGUAGE;
    }
  }

  function translate(source) {
    if (language === "en") return source;
    return translations[language]?.[source] || source;
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
    try { localStorage.setItem(STORAGE_KEY, next); } catch (_) {}
    applyDocument();
    window.dispatchEvent(new CustomEvent("vasi:languagechange", { detail: { language: next } }));
    return true;
  }

  function init() {
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
