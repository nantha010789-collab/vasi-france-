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

  const extendedTranslations = {
    fr: {
      "Driver": "Chauffeur", "Ride partner": "Partenaire de trajet", "Ride chat": "Chat du trajet", "Chat with your driver": "Chat avec votre chauffeur", "Chat with your customer": "Chat avec votre client", "Live chat & calls": "Chat et appels en direct", "Voice call": "Appel vocal", "Start voice call": "Démarrer l’appel vocal", "Incoming voice call": "Appel vocal entrant", "Calling": "Appel de", "is calling": "vous appelle", "Joining": "Connexion avec", "Starting microphone…": "Activation du microphone…", "Waiting for an answer": "En attente d’une réponse", "Connected": "Connecté", "Reconnecting…": "Reconnexion…", "Decline": "Refuser", "Answer": "Répondre", "Mute": "Couper le micro", "Unmute": "Activer le micro", "End call": "Raccrocher", "Call declined": "Appel refusé", "Call ended": "Appel terminé", "No answer": "Aucune réponse", "Call connection failed. Please try again.": "Échec de la connexion. Réessayez.", "Voice calls are not supported by this browser.": "Les appels vocaux ne sont pas pris en charge par ce navigateur.", "Allow microphone access in your phone settings, then try again.": "Autorisez le microphone dans les réglages du téléphone, puis réessayez.", "The microphone could not be started. Please try again.": "Le microphone n’a pas pu démarrer. Réessayez.", "Chat · Voice call": "Chat · Appel vocal",
      "Resend SMS code": "Renvoyer le code SMS", "Requesting new code…": "Demande d’un nouveau code…", "Checking your code…": "Vérification du code…", "Enter the most recently received 6-digit SMS code.": "Saisissez le dernier code SMS à 6 chiffres reçu.", "This SMS code has expired or was already used. Tap Resend SMS code for a new code.": "Ce code SMS a expiré ou a déjà été utilisé. Touchez Renvoyer le code SMS.", "The SMS code is incorrect. Check the newest message and try again.": "Le code SMS est incorrect. Vérifiez le message le plus récent.",
      "Drive with VASI": "Conduisez avec VASI", "Go online": "Se mettre en ligne", "ONLINE": "EN LIGNE", "OFFLINE": "HORS LIGNE", "Verified driver": "Chauffeur vérifié", "Verification required": "Vérification requise", "Current ride": "Trajet actuel", "No active ride": "Aucun trajet actif", "Ride requests": "Demandes de trajet", "No new ride requests.": "Aucune nouvelle demande.", "Accept ride": "Accepter le trajet", "Start Ride": "Démarrer le trajet", "Complete Ride": "Terminer le trajet", "Open navigation to pickup": "Ouvrir la navigation vers le départ", "Arrived at Pickup": "Arrivé au point de départ", "Food orders": "Commandes de repas", "Deliveries": "Livraisons", "Connect Stripe": "Connecter Stripe", "Sign out": "Déconnexion",
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
      "Resend SMS code": "SMS कोड फिर भेजें", "Requesting new code…": "नया कोड माँगा जा रहा है…", "Checking your code…": "कोड जाँचा जा रहा है…", "Enter the most recently received 6-digit SMS code.": "सबसे नया 6 अंकों का SMS कोड डालें।", "This SMS code has expired or was already used. Tap Resend SMS code for a new code.": "यह SMS कोड समाप्त हो गया या उपयोग हो चुका है। नया कोड माँगें।", "The SMS code is incorrect. Check the newest message and try again.": "SMS कोड गलत है। नवीनतम संदेश देखें।",
      "Drive with VASI": "VASI के साथ ड्राइव करें", "Go online": "ऑनलाइन जाएँ", "ONLINE": "ऑनलाइन", "OFFLINE": "ऑफ़लाइन", "Verified driver": "सत्यापित ड्राइवर", "Verification required": "सत्यापन आवश्यक", "Current ride": "मौजूदा राइड", "No active ride": "कोई सक्रिय राइड नहीं", "Ride requests": "राइड अनुरोध", "No new ride requests.": "कोई नया राइड अनुरोध नहीं।", "Accept ride": "राइड स्वीकार करें", "Start Ride": "राइड शुरू करें", "Complete Ride": "राइड पूरी करें", "Open navigation to pickup": "पिकअप के लिए नेविगेशन खोलें", "Arrived at Pickup": "पिकअप पर पहुँचे", "Food orders": "खाने के ऑर्डर", "Deliveries": "डिलीवरी", "Connect Stripe": "Stripe जोड़ें", "Sign out": "लॉग आउट",
      "Grow your restaurant.": "अपने रेस्टोरेंट को बढ़ाएँ।", "Join VASI": "VASI से जुड़ें", "Partner dashboard": "पार्टनर डैशबोर्ड", "Restaurant name": "रेस्टोरेंट का नाम", "Business email": "व्यावसायिक ईमेल", "Restaurant address": "रेस्टोरेंट का पता", "Submit for VASI approval": "VASI मंज़ूरी के लिए भेजें", "Menu": "मेन्यू", "Orders": "ऑर्डर", "Add item": "आइटम जोड़ें", "No menu items yet.": "अभी कोई मेन्यू आइटम नहीं।", "No orders yet.": "अभी कोई ऑर्डर नहीं।", "Online": "ऑनलाइन", "Offline": "ऑफ़लाइन", "Approve": "मंज़ूर", "Reject": "अस्वीकार", "Dashboard": "डैशबोर्ड", "Refresh": "रीफ़्रेश",
      "Incoming VASI voice call": "आने वाली VASI वॉइस कॉल", "Your ride partner is calling inside VASI.": "आपका राइड साथी VASI में कॉल कर रहा है।", "Enable phone alerts": "फ़ोन अलर्ट चालू करें", "Alerts enabled": "अलर्ट चालू हैं", "Updates": "अपडेट", "Mark all read": "सभी को पढ़ा हुआ करें", "Test phone alert": "फ़ोन अलर्ट जाँचें", "Check notifications on this device": "इस डिवाइस पर सूचनाएँ जाँचें", "VASI test successful": "VASI परीक्षण सफल", "Phone alerts work on this device. Keep VASI installed for ride updates.": "इस डिवाइस पर फ़ोन अलर्ट काम करते हैं। राइड अपडेट के लिए VASI इंस्टॉल रखें।"
    }
  };
  Object.entries(extendedTranslations).forEach(([code, values]) => Object.assign(translations[code], values));

  const surfaceTranslations = {
    fr: {
      "Approved local restaurants, live menus and protected delivery.": "Restaurants locaux approuvés, menus à jour et livraison sécurisée.",
      "Search restaurants, dishes or allergens": "Rechercher des restaurants, plats ou allergènes",
      "Search restaurant, dish or cuisine…": "Rechercher un restaurant, un plat ou une cuisine…",
      "Cuisine filters": "Filtres de cuisine",
      "Own a restaurant?": "Vous gérez un restaurant ?",
      "Loading partner restaurants…": "Chargement des restaurants partenaires…",
      "Your basket": "Votre panier",
      "items ·": "articles ·",
      "View basket →": "Voir le panier →",
      "New basket started. You can order from one restaurant at a time.": "Un nouveau panier a été créé. Vous pouvez commander auprès d’un seul restaurant à la fois.",
      "All food": "Toutes les cuisines",
      "Local restaurant": "Restaurant local",
      "OPEN": "OUVERT",
      "Min.": "Min.",
      "Freshly prepared": "Préparé à la commande",
      "Allergens": "Allergènes",
      "Remove one": "Retirer un",
      "No matching food found.": "Aucun plat ne correspond à votre recherche.",
      "Try another dish, cuisine or allergen search.": "Essayez un autre plat, une autre cuisine ou un autre allergène.",
      "No restaurants are available yet.": "Aucun restaurant n’est encore disponible.",
      "Approved partners will appear here as soon as their menus are ready.": "Les partenaires approuvés apparaîtront ici dès que leurs menus seront prêts.",
      "Add an item before checkout.": "Ajoutez un article avant de passer la commande.",
      "Menu unavailable": "Menu indisponible",
      "Drop-off": "Destination",
      "Small & medium": "Petit et moyen format",
      "Fast & secure": "Rapide et sécurisé",
      "Enter pickup and drop-off to continue.": "Indiquez le départ et la destination pour continuer.",
      "Get a new quote for the parcel.": "Obtenez un nouveau tarif pour le colis.",
      "Get a new quote for the document.": "Obtenez un nouveau tarif pour le document.",
      "Delivery service unavailable": "Service de livraison indisponible",
      "Please enter both pickup and drop-off locations.": "Indiquez les adresses de départ et de destination.",
      "Checking the real route and price…": "Calcul de l’itinéraire réel et du tarif…",
      "about": "environ",
      "Booking your VASI delivery…": "Réservation de votre livraison VASI…",
      "Please login before booking.": "Connectez-vous avant de commander.",
      "Delivery booked successfully.": "Livraison réservée.",
      "Booking ID": "Numéro de réservation",
      "Booked": "Réservée",
      "Could not book delivery. Please try again.": "Impossible de réserver la livraison. Réessayez.",
      "Return to VASI home": "Retour à l’accueil VASI",
      "Customer sign-in method": "Mode de connexion client",
      "Enter your email. We will send you a secure sign-in link.": "Saisissez votre e-mail. Nous vous enverrons un lien de connexion sécurisé.",
      "Continue with email": "Continuer avec mon e-mail",
      "New restaurant? Join VASI →": "Nouveau restaurant ? Rejoignez VASI →",
      "New partner? Register with VASI →": "Nouveau partenaire ? Inscrivez-vous sur VASI →",
      "Ride = passenger trips. Courier = delivery. Restaurant = food partner.": "Trajet = transport de passagers. Livreur = livraison. Restaurant = partenaire de restauration.",
      "Login help:": "Aide à la connexion :",
      "Resend code in 90s": "Renvoyer le code dans 90 s"
    },
    ta: {
      "Approved local restaurants, live menus and protected delivery.": "அங்கீகரிக்கப்பட்ட உள்ளூர் உணவகங்கள், நேரடி மெனுக்கள் மற்றும் பாதுகாப்பான டெலிவரி.",
      "Search restaurants, dishes or allergens": "உணவகங்கள், உணவுகள் அல்லது ஒவ்வாமைப் பொருட்களைத் தேடுங்கள்",
      "Search restaurant, dish or cuisine…": "உணவகம், உணவு அல்லது சமையல் வகையைத் தேடுங்கள்…",
      "Cuisine filters": "சமையல் வகை வடிகட்டிகள்",
      "Own a restaurant?": "உங்களிடம் உணவகம் உள்ளதா?",
      "Loading partner restaurants…": "பார்ட்னர் உணவகங்கள் ஏற்றப்படுகின்றன…",
      "Your basket": "உங்கள் கூடை",
      "items ·": "உணவுகள் ·",
      "View basket →": "கூடையைப் பார்க்கவும் →",
      "New basket started. You can order from one restaurant at a time.": "புதிய கூடை தொடங்கப்பட்டது. ஒரே நேரத்தில் ஒரு உணவகத்திலிருந்து மட்டும் ஆர்டர் செய்யலாம்.",
      "All food": "அனைத்து உணவுகளும்",
      "Local restaurant": "உள்ளூர் உணவகம்",
      "OPEN": "திறந்துள்ளது",
      "Freshly prepared": "புதிதாக தயாரிக்கப்பட்டது",
      "Allergens": "ஒவ்வாமைப் பொருட்கள்",
      "Remove one": "ஒன்றை நீக்கவும்",
      "No matching food found.": "பொருந்தும் உணவு கிடைக்கவில்லை.",
      "Try another dish, cuisine or allergen search.": "வேறு உணவு, சமையல் வகை அல்லது ஒவ்வாமைப் பொருளைத் தேடுங்கள்.",
      "No restaurants are available yet.": "இன்னும் எந்த உணவகமும் கிடைக்கவில்லை.",
      "Approved partners will appear here as soon as their menus are ready.": "அங்கீகரிக்கப்பட்ட பார்ட்னர்களின் மெனுக்கள் தயாரானதும் இங்கே தோன்றும்.",
      "Add an item before checkout.": "Checkout செய்வதற்கு முன் ஒரு உணவைச் சேர்க்கவும்.",
      "Menu unavailable": "மெனு கிடைக்கவில்லை",
      "Drop-off": "சேருமிடம்",
      "Small & medium": "சிறிய மற்றும் நடுத்தர அளவு",
      "Fast & secure": "வேகமும் பாதுகாப்பும்",
      "Enter pickup and drop-off to continue.": "தொடர புறப்படும் இடம் மற்றும் சேருமிடத்தை உள்ளிடுங்கள்.",
      "Get a new quote for the parcel.": "பார்சலுக்குப் புதிய விலையைப் பெறுங்கள்.",
      "Get a new quote for the document.": "ஆவணத்திற்குப் புதிய விலையைப் பெறுங்கள்.",
      "Delivery service unavailable": "டெலிவரி சேவை கிடைக்கவில்லை",
      "Please enter both pickup and drop-off locations.": "புறப்படும் இடம் மற்றும் சேருமிடம் இரண்டையும் உள்ளிடுங்கள்.",
      "Checking the real route and price…": "உண்மையான வழித்தடமும் விலையும் கணக்கிடப்படுகிறது…",
      "about": "சுமார்",
      "Booking your VASI delivery…": "உங்கள் VASI டெலிவரி பதிவு செய்யப்படுகிறது…",
      "Please login before booking.": "பதிவு செய்வதற்கு முன் உள்நுழையுங்கள்.",
      "Delivery booked successfully.": "டெலிவரி வெற்றிகரமாக பதிவு செய்யப்பட்டது.",
      "Booking ID": "பதிவு எண்",
      "Booked": "பதிவு செய்யப்பட்டது",
      "Could not book delivery. Please try again.": "டெலிவரியை பதிவு செய்ய முடியவில்லை. மீண்டும் முயற்சிக்கவும்.",
      "Enter your email. We will send you a secure sign-in link.": "உங்கள் மின்னஞ்சலை உள்ளிடுங்கள். பாதுகாப்பான உள்நுழைவு இணைப்பை அனுப்புவோம்.",
      "Continue with email": "மின்னஞ்சலுடன் தொடரவும்",
      "New restaurant? Join VASI →": "புதிய உணவகமா? VASI-ல் இணையுங்கள் →",
      "New partner? Register with VASI →": "புதிய பார்ட்னரா? VASI-ல் பதிவு செய்யுங்கள் →",
      "Ride = passenger trips. Courier = delivery. Restaurant = food partner.": "Ride = பயணிகள் பயணம். Courier = டெலிவரி. Restaurant = உணவு பார்ட்னர்.",
      "Login help:": "உள்நுழைவு உதவி:"
    }
  };
  Object.entries(surfaceTranslations).forEach(([code, values]) => Object.assign(translations[code], values));

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
