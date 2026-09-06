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
      "One VASI app for rides, food and delivery.": "VASI pour vos trajets, repas et livraisons.",
      "Ride": "Trajet",
      "Fast city trips": "Trajets en ville",
      "Eats": "Repas",
      "Food delivery": "Repas livrés",
      "Delivery": "Livraison",
      "Send anything": "Envoyez un colis",
      "Services": "Services",
      "3 ready": "3 services disponibles",
      "France & Europe": "France et Europe",
      "Book a ride": "Commander un trajet",
      "Driver app": "Application chauffeur",
      "AI Customer Service": "Service client IA",
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
      "Bank account and payouts": "Compte bancaire et versements",
      "You add your own RIB": "Vous ajoutez vous-même votre RIB",
      "After VASI approves your documents, open the Driver or Courier app and tap “Connect bank account (RIB)”. You enter your IBAN on Stripe’s secure page. VASI does not store your full IBAN.": "Après validation de vos documents par VASI, ouvrez l’application Chauffeur ou Livreur et touchez « Connecter mon compte bancaire (RIB) ». Vous saisirez votre IBAN sur la page sécurisée de Stripe. VASI ne stocke pas votre IBAN complet.",
      "Application sent. After approval, connect your bank account (RIB) yourself in the VASI app.": "Dossier envoyé. Après validation, connectez vous-même votre compte bancaire (RIB) dans l’application VASI.",
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
      "Resend code in 90s": "Renvoyer le code dans 90 s",
      "Phone": "Téléphone"
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
      "Login help:": "உள்நுழைவு உதவி:",
      "Phone": "தொலைபேசி"
    }
  };
  Object.entries(surfaceTranslations).forEach(([code, values]) => Object.assign(translations[code], values));

  const completeFrenchTranslations = {
    "VASI Login & Registration": "Connexion et inscription VASI",
    "VASI — Move. Eat. Deliver.": "VASI — Déplacez-vous. Mangez. Faites livrer.",
    "SMS delivery can take up to 2 minutes on some mobile networks. Resending cancels every earlier code, so after a resend use only the code from the newest SMS.": "La réception du SMS peut prendre jusqu’à 2 minutes sur certains réseaux mobiles. Un renvoi annule tous les codes précédents : utilisez uniquement le code du SMS le plus récent.",
    "Your account · VASI": "Votre compte · VASI",
    "Your VASI": "Votre espace VASI",
    "Your personal details, preferences and support in one place.": "Vos informations personnelles, vos préférences et l’assistance au même endroit.",
    "Loading your account…": "Chargement de votre compte…",
    "Try again": "Réessayer",
    "VASI customer": "Client VASI",
    "No verified phone": "Aucun téléphone vérifié",
    "Profile needs details": "Profil à compléter",
    "Add photo": "Ajouter une photo",
    "Remove": "Supprimer",
    "Optional · JPG, PNG or WebP · max 2 MB": "Facultatif · JPG, PNG ou WebP · 2 Mo maximum",
    "One quick step.": "Une étape rapide.",
    "Add your name so rides, orders and customer support can identify your account correctly.": "Ajoutez votre nom afin que les trajets, les commandes et l’assistance puissent identifier correctement votre compte.",
    "Personal information": "Informations personnelles",
    "Your verified phone cannot be changed from this page.": "Votre téléphone vérifié ne peut pas être modifié depuis cette page.",
    "Full name": "Nom complet",
    "Verified mobile number": "Numéro de mobile vérifié",
    "Verified": "Vérifié",
    "Contact email": "E-mail de contact",
    "optional": "facultatif",
    "Adding or changing an email may require confirmation from your inbox.": "L’ajout ou la modification d’un e-mail peut nécessiter une confirmation depuis votre boîte de réception.",
    "Country": "Pays",
    "France": "France",
    "Belgium": "Belgique",
    "Germany": "Allemagne",
    "Spain": "Espagne",
    "Italy": "Italie",
    "Netherlands": "Pays-Bas",
    "United Kingdom": "Royaume-Uni",
    "Switzerland": "Suisse",
    "Preferred currency": "Devise préférée",
    "Save changes": "Enregistrer les modifications",
    "Saved addresses": "Adresses enregistrées",
    "Save Home, Work or one Other address for faster bookings.": "Enregistrez Domicile, Travail ou une autre adresse pour réserver plus rapidement.",
    "Loading your saved addresses…": "Chargement de vos adresses enregistrées…",
    "Add address": "Ajouter une adresse",
    "Label": "Libellé",
    "Work": "Travail",
    "Other": "Autre",
    "Street address": "Adresse",
    "Postal code": "Code postal",
    "City": "Ville",
    "Save address": "Enregistrer l’adresse",
    "Manage trips, orders, deliveries and help requests.": "Gérez vos trajets, commandes, livraisons et demandes d’aide.",
    "Rides, food orders and deliveries": "Trajets, commandes de repas et livraisons",
    "Notifications, privacy, security and safety": "Notifications, confidentialité et sécurité",
    "Help & support": "Aide et assistance",
    "Get help with your VASI account": "Obtenir de l’aide pour votre compte VASI",
    "VASI customer account": "Compte client VASI",
    "VASI home": "Accueil VASI",
    "Account summary": "Résumé du compte",
    "Customer profile photo": "Photo de profil du client",
    "Your full name": "Votre nom complet",
    "Account destinations": "Destinations du compte",
    "Settings · VASI": "Paramètres · VASI",
    "During a live trip:": "Pendant un trajet en cours :",
    "SOS, Share Trip and ride details remain available on the active ride screen.": "Le SOS, le partage du trajet et les détails restent disponibles sur l’écran du trajet en cours.",
    "Offers and marketing": "Offres et marketing",
    "VASI language": "Langue VASI",
    "VASI Activity": "Activité VASI",
    "Your account": "Votre compte",
    "Rides, food and deliveries in one place.": "Vos trajets, repas et livraisons au même endroit.",
    "All": "Tout",
    "Rides": "Trajets",
    "Loading your activity…": "Chargement de votre activité…",
    "VASI Ride": "Trajet VASI",
    "Use my current location": "Utiliser ma position actuelle",
    "Tap map to choose destination": "Touchez la carte pour choisir la destination",
    "Search": "Rechercher",
    "Confirm the map pin": "Confirmer le repère sur la carte",
    "Drag the destination pin if needed, then confirm it.": "Déplacez le repère de destination si nécessaire, puis confirmez-le.",
    "Confirm destination": "Confirmer la destination",
    "Saved places": "Lieux enregistrés",
    "Manage": "Gérer",
    "Route": "Itinéraire",
    "VASI offer price": "Tarif de l’offre VASI",
    "Choose vehicle": "Choisir un véhicule",
    "Upfront fare": "Tarif annoncé",
    "Pickup time": "Heure de départ",
    "Custom date & time": "Date et heure personnalisées",
    "Use this pickup time": "Utiliser cette heure de départ",
    "Cancellation": "Annulation",
    "Free before driver accepts": "Gratuit avant l’acceptation du chauffeur",
    "Waiting": "Attente",
    "3 min free · €0.30/min": "3 min gratuites · 0,30 €/min",
    "Request VASI ride": "Commander un trajet VASI",
    "VASI driver": "Chauffeur VASI",
    "Finding your driver…": "Recherche de votre chauffeur…",
    "View receipt": "Voir le reçu",
    "Cancel ride · €5": "Annuler le trajet · 5 €",
    "Getting your pickup location…": "Recherche de votre position de départ…",
    "Authorize your VASI fare": "Autoriser votre tarif VASI",
    "Your card or Apple Pay is charged only after the ride is completed.": "Votre carte ou Apple Pay n’est débité qu’une fois le trajet terminé.",
    "Authorize payment": "Autoriser le paiement",
    "Not now": "Pas maintenant",
    "Enter destination or place": "Saisir une destination ou un lieu",
    "Destination suggestions": "Suggestions de destination",
    "Your VASI rides and receipts.": "Vos trajets et reçus VASI.",
    "Loading rides…": "Chargement des trajets…",
    "VASI Ride Chat": "Chat du trajet VASI",
    "Chat · Voice call": "Chat · Appel vocal",
    "Safety Centre · PIN · Share trip": "Centre de sécurité · PIN · Partager le trajet",
    "Loading your ride…": "Chargement de votre trajet…",
    "Connecting…": "Connexion…",
    "Loading messages…": "Chargement des messages…",
    "Send": "Envoyer",
    "Message": "Message",
    "Write a message": "Écrire un message",
    "VASI Eats Checkout": "Paiement VASI Eats",
    "Checkout": "Paiement",
    "Your price and courier protection are calculated securely.": "Votre prix et la protection du livreur sont calculés de façon sécurisée.",
    "Loading…": "Chargement…",
    "Subtotal": "Sous-total",
    "Service fee": "Frais de service",
    "Total": "Total",
    "Continue to secure payment": "Continuer vers le paiement sécurisé",
    "Card payment is processed securely by Stripe. The courier is paid only after your delivery PIN.": "Le paiement par carte est traité de façon sécurisée par Stripe. Le livreur est payé uniquement après votre code PIN de livraison.",
    "Pay now": "Payer maintenant",
    "Checking basket…": "Vérification du panier…",
    "Full delivery address": "Adresse complète de livraison",
    "VASI Support": "Assistance VASI",
    "24/7 help": "Aide 24 h/24 et 7 j/7",
    "Tamil · English · French. For immediate danger call": "Tamoul · anglais · français. En cas de danger immédiat, appelez",
    "Ride driver": "Chauffeur de trajet",
    "Food order": "Commande de repas",
    "Payment / refund": "Paiement / remboursement",
    "Account / login": "Compte / connexion",
    "Restaurant partner": "Restaurant partenaire",
    "Send to VASI Support": "Envoyer à l’assistance VASI",
    "Temporary support email": "E-mail temporaire de l’assistance",
    "Contact us:": "Nous contacter :",
    "Your support tickets": "Vos demandes d’assistance",
    "Short title": "Titre court",
    "Tell VASI what happened…": "Expliquez à VASI ce qui s’est passé…",
    "VASI Safety Centre": "Centre de sécurité VASI",
    "Emergency help, ride-start PIN, and a private live trip link in one place.": "L’aide d’urgence, le code PIN de départ et le lien privé du trajet en direct au même endroit.",
    "Emergency assistance": "Assistance d’urgence",
    "If you or someone else is in immediate danger in France or the EU, call 112.": "Si vous ou une autre personne êtes en danger immédiat en France ou dans l’UE, appelez le 112.",
    "Call emergency services · 112": "Appeler les secours · 112",
    "Ride-start PIN": "Code PIN de départ",
    "Give this PIN to your driver only after you are inside the correct vehicle.": "Communiquez ce code PIN au chauffeur uniquement lorsque vous êtes dans le bon véhicule.",
    "Share live trip": "Partager le trajet en direct",
    "Share an unlisted link with someone you trust. Your phone number and email are never shown.": "Partagez un lien privé avec une personne de confiance. Votre téléphone et votre e-mail ne sont jamais affichés.",
    "Stop sharing": "Arrêter le partage",
    "Loading ride…": "Chargement du trajet…",
    "VASI Driver": "Chauffeur VASI",
    "Support": "Assistance",
    "Log out": "Se déconnecter",
    "GPS off": "GPS désactivé",
    "Verified VASI ride drivers can go online and receive nearby ride requests.": "Les chauffeurs VASI vérifiés peuvent se mettre en ligne et recevoir les demandes de trajet à proximité.",
    "VASI Courier": "Livreur VASI",
    "COURIER · EATS + DELIVERY": "LIVREUR · EATS + LIVRAISON",
    "Checking courier account…": "Vérification du compte livreur…",
    "Courier status": "Statut du livreur",
    "Payments RIB": "Paiements sur RIB",
    "Checking payout account…": "Vérification du compte de versement…",
    "Connect my RIB": "Connecter mon RIB",
    "Go online to see courier jobs.": "Mettez-vous en ligne pour voir les missions de livraison.",
    "Join VASI · Restaurant": "Rejoindre VASI · Restaurant",
    "Restaurant partners": "Partenaires restaurants",
    "Join VASI.": "Rejoignez VASI.",
    "Create your restaurant account, register your establishment, then add your menu after approval.": "Créez votre compte restaurateur, enregistrez votre établissement puis ajoutez votre menu après validation.",
    "Simple restaurant commission · 10%": "Commission restaurant simple · 10 %",
    "One 10% rate on ordered items, regardless of delivery service · €0 setup fee.": "Un taux unique de 10 % sur les articles commandés, quel que soit le service de livraison · 0 € de frais d’installation.",
    "Restaurant account": "Compte restaurateur",
    "Enter your email. We will send you a secure link to create your account or sign in.": "Entrez votre e-mail. Nous vous enverrons un lien sécurisé pour créer votre compte ou vous connecter.",
    "Owner email": "E-mail du propriétaire",
    "Create my restaurant account": "Créer mon compte restaurant",
    "or": "ou",
    "Continue with my phone number": "Continuer avec mon numéro de téléphone",
    "SMS lets you continue immediately if your email is delayed.": "Le SMS permet de continuer immédiatement si votre e-mail tarde à arriver.",
    "Use another account": "Utiliser un autre compte",
    "Your restaurant": "Votre restaurant",
    "Complete the business information. The VASI team will verify it before going live.": "Complétez les informations professionnelles. L’équipe VASI les vérifiera avant la mise en ligne.",
    "Legal name": "Raison sociale",
    "Cuisine type": "Type de cuisine",
    "Delivery service": "Service de livraison",
    "VASI courier · 10%": "Coursier VASI · 10 %",
    "My own team · 10%": "Ma propre équipe · 10 %",
    "Your information is used only to verify and manage your VASI restaurant partnership.": "Vos informations servent uniquement à vérifier et gérer votre partenariat restaurant VASI.",
    "Your account is connected. You can now register your restaurant.": "Votre compte est connecté. Vous pouvez maintenant enregistrer votre restaurant.",
    "Connected VASI account": "Compte VASI connecté",
    "Restaurant account ready.": "Compte restaurateur prêt.",
    "Could not sign in. Try again.": "Connexion impossible. Réessayez.",
    "Sending secure link…": "Envoi du lien sécurisé…",
    "Email sent. Open the link you received to continue registration.": "E-mail envoyé. Ouvrez le lien reçu pour continuer votre inscription.",
    "Create or sign in to your restaurant account first.": "Créez ou connectez d’abord votre compte restaurant.",
    "Securely sending your application…": "Envoi sécurisé de votre demande…",
    "Your application could not be sent.": "Votre demande n’a pas pu être envoyée.",
    "Application received. Opening your restaurant space…": "Demande reçue. Ouverture de votre espace restaurant…",
    "Restaurant dashboard · VASI": "Tableau de bord restaurant · VASI",
    "VASI Partner": "Partenaire VASI",
    "Loading restaurant…": "Chargement du restaurant…",
    "Partner registration · VASI": "Inscription partenaire VASI",
    "Become a VASI partner": "Devenir partenaire VASI",
    "Create one account to drive passengers or make deliveries.": "Créez un seul compte pour conduire des passagers ou effectuer des livraisons.",
    "Choose your activity": "Choisissez votre activité",
    "VTC driver": "Chauffeur VTC",
    "Passenger transport": "Transport de passagers",
    "VASI Eats + Delivery": "VASI Eats + Livraison",
    "Identity": "Identité",
    "Address": "Adresse",
    "Identity document": "Pièce d’identité",
    "Profile photo": "Photo de profil",
    "Optional": "Facultatif",
    "Vehicle and documents": "Véhicule et documents",
    "Bicycle": "Vélo",
    "E-bike · 25 km/h max.": "VAE · 25 km/h max.",
    "Car": "Voiture",
    "No driving licence required": "Aucun permis de conduire requis",
    "For a compliant bicycle or e-bike (assistance up to 25 km/h): no licence, registration document or vehicle insurance is required. A faster motorized cycle must be registered as a scooter/motorcycle.": "Pour un vélo ou un VAE conforme (assistance jusqu’à 25 km/h) : pas de permis, carte grise ou assurance véhicule à télécharger. Un cycle motorisé plus rapide doit être inscrit en scooter/moto.",
    "Motor vehicle": "Véhicule motorisé",
    "A licence, insurance, registration document and transport documents are required.": "Le permis, l’assurance, la carte grise et les justificatifs de transport sont obligatoires.",
    "VTC professional card": "Carte professionnelle VTC",
    "Driving licence": "Permis de conduire",
    "Professional insurance": "Assurance professionnelle",
    "Vehicle registration": "Carte grise",
    "Proof of your independent activity in France.": "Preuve de votre activité indépendante en France.",
    "RIB in your name": "RIB à votre nom",
    "Used only to pay your earnings.": "Utilisé uniquement pour le versement de vos revenus.",
    "Insulated bag photo": "Photo du sac isotherme",
    "Bicycle photo": "Photo du vélo",
    "Vehicle insurance": "Assurance du véhicule",
    "Light transport capacity / licence": "Capacité / licence de transport léger",
    "Live verification": "Vérification en direct",
    "Take a live selfie to confirm the account belongs to you.": "Prenez un selfie en direct pour confirmer que le compte vous appartient.",
    "Take selfie": "Prendre le selfie",
    "I accept identity verification and secure processing of my documents by VASI.": "J’accepte la vérification d’identité et le traitement sécurisé de mes documents par VASI.",
    "Required documents must be approved by a VASI administrator before you go online.": "Les documents obligatoires doivent être validés par un administrateur VASI avant la mise en ligne.",
    "Submit for approval": "Envoyer pour validation",
    "Navigation": "Navigation",
    "Your full address": "Votre adresse complète",
    "Allow camera access to take your selfie.": "Autorisez la caméra pour prendre votre selfie.",
    "The camera is not ready yet. Try again.": "La caméra n’est pas encore prête. Réessayez.",
    "Selfie saved.": "Selfie enregistré.",
    "Enter your phone number.": "Saisissez votre numéro de téléphone.",
    "Accept verification to continue.": "Acceptez la vérification pour continuer.",
    "Application sent. VASI will notify you after verification.": "Dossier envoyé. VASI vous informera après la vérification.",
    "Application sent": "Dossier envoyé",
    "Could not send": "Envoi impossible",
    "Indian, French, pizza…": "Indienne, française, pizza…",
  };
  Object.assign(translations.fr, completeFrenchTranslations);

  const dynamicFrenchTranslations = {
    "Change photo": "Modifier la photo",
    "Preparing your optional profile photo…": "Préparation de votre photo de profil facultative…",
    "Profile photo saved.": "Photo de profil enregistrée.",
    "We could not save that photo. Please try again.": "Impossible d’enregistrer cette photo. Réessayez.",
    "Removing your profile photo…": "Suppression de votre photo de profil…",
    "Profile photo removed.": "Photo de profil supprimée.",
    "We could not remove that photo. Please try again.": "Impossible de supprimer cette photo. Réessayez.",
    "Saving…": "Enregistrement…",
    "Edit": "Modifier",
    "Delete": "Supprimer",
    "No saved addresses yet. Add Home, Work or Other.": "Aucune adresse enregistrée. Ajoutez Domicile, Travail ou Autre.",
    "Edit address": "Modifier l’adresse",
    "We could not load your saved addresses.": "Impossible de charger vos adresses enregistrées.",
    "Choose Home, Work or Other.": "Choisissez Domicile, Travail ou Autre.",
    "Choose a supported country.": "Choisissez un pays pris en charge.",
    "Enter a valid street address.": "Saisissez une adresse valide.",
    "Enter a valid postal code.": "Saisissez un code postal valide.",
    "Enter a valid city.": "Saisissez une ville valide.",
    "Saving your address…": "Enregistrement de votre adresse…",
    "That label is already saved. Edit the existing address instead.": "Ce libellé est déjà enregistré. Modifiez plutôt l’adresse existante.",
    "We could not save your address. Try again.": "Impossible d’enregistrer votre adresse. Réessayez.",
    "Delete your address?": "Supprimer votre adresse ?",
    "We could not delete that address. Try again.": "Impossible de supprimer cette adresse. Réessayez.",
    "Confirm your profile": "Confirmer votre profil",
    "Complete your profile": "Compléter votre profil",
    "Check your details once, then continue to VASI.": "Vérifiez vos informations, puis continuez vers VASI.",
    "Profile ready": "Profil prêt",
    "Before you continue.": "Avant de continuer.",
    "Confirm your account details, then save to continue.": "Confirmez les informations de votre compte, puis enregistrez pour continuer.",
    "Member since": "Membre depuis",
    "We could not load your account. Please try again.": "Impossible de charger votre compte. Réessayez.",
    "Enter your full name.": "Saisissez votre nom complet.",
    "Your name must be 80 characters or fewer.": "Votre nom doit contenir 80 caractères maximum.",
    "Enter a valid email address.": "Saisissez une adresse e-mail valide.",
    "Keep your current email or enter a new email address.": "Conservez votre e-mail actuel ou saisissez une nouvelle adresse.",
    "Choose a supported currency.": "Choisissez une devise prise en charge.",
    "Saving your profile…": "Enregistrement de votre profil…",
    "Profile saved, but the email could not be updated:": "Profil enregistré, mais l’e-mail n’a pas pu être mis à jour :",
    "Check your inbox to confirm the new email.": "Consultez votre boîte de réception pour confirmer le nouvel e-mail.",
    "Your VASI profile is saved.": "Votre profil VASI est enregistré.",
    "Continuing…": "Redirection…",
    "We could not save your profile. Please try again.": "Impossible d’enregistrer votre profil. Réessayez.",
    "Signing out…": "Déconnexion…",
    "Install VASI to receive phone alerts": "Installez VASI pour recevoir les alertes sur votre téléphone",
    "Phone alerts enabled · manage optional alerts": "Alertes activées · gérer les alertes facultatives",
    "Phone alerts blocked in device settings": "Alertes bloquées dans les réglages de l’appareil",
    "Phone alert permission not enabled": "Autorisation des alertes non activée",
    "Location is not supported on this device": "La localisation n’est pas prise en charge sur cet appareil",
    "Checking location permission…": "Vérification de l’autorisation de localisation…",
    "Location access is available for VASI": "La localisation est disponible pour VASI",
    "Location is blocked · allow it in phone settings": "Localisation bloquée · autorisez-la dans les réglages du téléphone",
    "Location is unavailable right now": "La localisation est actuellement indisponible",
    "Preparing your data copy…": "Préparation de la copie de vos données…",
    "Your VASI data copy is ready.": "La copie de vos données VASI est prête.",
    "Data download cancelled.": "Téléchargement des données annulé.",
    "We could not prepare the data copy. Please try again.": "Impossible de préparer la copie des données. Réessayez.",
    "Sign out this VASI account on every device?": "Déconnecter ce compte VASI sur tous les appareils ?",
    "Signing out all devices…": "Déconnexion de tous les appareils…",
    "Could not sign out all devices.": "Impossible de déconnecter tous les appareils.",
    "No support tickets yet.": "Aucune demande d’assistance.",
    "VASI is checking your request…": "VASI vérifie votre demande…",
    "created.": "créée.",
    "Please help me delete my VASI account after verifying my identity.": "Aidez-moi à supprimer mon compte VASI après vérification de mon identité.",
    "Enter your address for the final delivery price.": "Saisissez votre adresse pour obtenir le prix final de livraison.",
    "Return to the menu.": "Retournez au menu.",
    "Please enter your full delivery address.": "Saisissez votre adresse complète de livraison.",
    "Checking address and preparing secure payment…": "Vérification de l’adresse et préparation du paiement sécurisé…",
    "Please login before ordering.": "Connectez-vous avant de commander.",
    "Could not prepare order": "Impossible de préparer la commande",
    "Card payment is not configured": "Le paiement par carte n’est pas configuré",
    "Final total confirmed. Enter your card details.": "Total final confirmé. Saisissez les informations de votre carte.",
    "Processing payment…": "Traitement du paiement…",
    "Card payment failed": "Échec du paiement par carte",
    "Login session expired": "La session de connexion a expiré",
    "Payment confirmation is still pending": "La confirmation du paiement est toujours en attente",
    "Payment successful. Your order is now visible to VASI couriers.": "Paiement réussi. Votre commande est maintenant visible par les livreurs VASI.",
    "Order ID": "Numéro de commande",
    "DELIVERY PIN": "CODE PIN DE LIVRAISON",
    "Give this PIN only when your food arrives. It releases the courier earning.": "Communiquez ce code PIN uniquement à la réception du repas. Il déclenche le paiement du livreur.",
    "View Eats activity": "Voir l’activité Eats",
    "No messages yet. Send a short message about your pickup.": "Aucun message. Envoyez un court message concernant votre point de départ.",
    "You": "Vous",
    "This ride has ended. Previous messages are still available.": "Ce trajet est terminé. Les messages précédents restent disponibles.",
    "Chat is available only while this ride is active.": "Le chat est disponible uniquement pendant le trajet.",
    "Message could not be sent. Please try again.": "Impossible d’envoyer le message. Réessayez.",
    "Ride information is missing.": "Les informations du trajet sont manquantes.",
    "Unavailable": "Indisponible",
    "This ride chat is not available.": "Le chat de ce trajet n’est pas disponible.",
    "Returning customer: a ride-start PIN is not required.": "Client existant : aucun code PIN de départ n’est requis.",
    "First-ride PIN verified. This ride was started by the assigned driver.": "Code PIN du premier trajet vérifié. Le chauffeur assigné a démarré le trajet.",
    "First VASI ride: give this PIN to your driver only after you are inside the correct vehicle.": "Premier trajet VASI : communiquez ce code PIN uniquement lorsque vous êtes dans le bon véhicule.",
    "For a first VASI ride, the PIN appears after a driver accepts.": "Pour un premier trajet VASI, le code PIN apparaît après l’acceptation d’un chauffeur.",
    "Share link again": "Partager de nouveau le lien",
    "GPS is required.": "Le GPS est obligatoire.",
    "Please allow location access.": "Autorisez l’accès à la localisation.",
    "GPS live": "GPS actif",
    "GPS denied": "GPS refusé",
    "Finish your active ride before going online again.": "Terminez votre trajet en cours avant de vous remettre en ligne.",
    "RIB setup becomes available after courier approval.": "La configuration du RIB est disponible après validation du livreur.",
    "RIB setup becomes available after restaurant approval.": "La configuration du RIB est disponible après validation du restaurant.",
    "RIB verified · earnings are released after the delivery PIN.": "RIB vérifié · les revenus sont versés après le code PIN de livraison.",
    "RIB verified · card-ride earnings are paid automatically every Monday.": "RIB vérifié · les revenus des trajets par carte sont versés automatiquement chaque lundi.",
    "RIB verified · restaurant earnings are paid automatically every Monday.": "RIB vérifié · les revenus du restaurant sont versés automatiquement chaque lundi.",
    "RIB details submitted. Stripe is checking your information.": "Informations bancaires envoyées. Stripe vérifie vos informations.",
    "Stripe is checking your payout information.": "Stripe vérifie vos informations de versement.",
    "Finish the secure Stripe RIB setup to receive payouts.": "Terminez la configuration sécurisée du RIB avec Stripe pour recevoir vos versements.",
    "Connect and verify your bank account (RIB) before going online.": "Connectez et faites vérifier votre compte bancaire (RIB) avant de vous mettre en ligne.",
    "Connect and verify your bank account (RIB) before opening your restaurant.": "Connectez et faites vérifier votre compte bancaire (RIB) avant d’ouvrir votre restaurant.",
    "Connect bank account (RIB)": "Connecter mon compte bancaire (RIB)",
    "Continue RIB verification": "Continuer la vérification du RIB",
    "Payments & RIB": "Paiements et RIB",
    "RIB required": "RIB requis",
    "Your payout": "Votre versement",
    "Restaurant payout": "Versement restaurant",
    "Payout:": "Versement :",
    "Retry payout": "Relancer le versement",
    "Complete delivery · enter PIN": "Terminer la livraison · saisir le PIN",
    "Enter the customer’s 4-digit delivery PIN": "Saisissez le code PIN de livraison à 4 chiffres du client",
    "Delivery completed. Restaurant payout released.": "Livraison terminée. Le versement du restaurant a été déclenché.",
    "Restaurant payout checked.": "Versement du restaurant vérifié.",
    "Opening secure Stripe RIB setup…": "Ouverture de la configuration sécurisée du RIB avec Stripe…",
    "Go offline": "Se mettre hors ligne",
    "Active job": "Mission en cours",
    "Enter the customer's 4-digit Eats delivery PIN": "Saisissez le code PIN de livraison Eats à 4 chiffres du client",
    "Enter the 4-digit delivery PIN": "Saisissez le code PIN de livraison à 4 chiffres",
    "Delivery completed.": "Livraison terminée.",
    "Sending…": "Envoi…",
    "Email service is temporarily unavailable. Continue with your phone number below.": "Le service e-mail est momentanément indisponible. Continuez avec votre numéro de téléphone ci-dessous.",
    "Email service is temporarily unavailable. Try again later.": "Le service e-mail est momentanément indisponible. Réessayez plus tard.",
    "Saved places unavailable": "Lieux enregistrés indisponibles",
    "Coming soon": "Bientôt disponible",
    "Pickup selected on map": "Point de départ sélectionné sur la carte",
    "Destination pin selected": "Repère de destination sélectionné",
    "Select pickup location": "Sélectionner le point de départ",
    "Current location": "Position actuelle",
    "Pickup selected": "Point de départ sélectionné",
    "VASI pickup": "Départ VASI",
    "Pickup map preview unavailable": "Aperçu de la carte de départ indisponible",
    "Choose your destination, then select your reserve time": "Choisissez votre destination, puis l’heure de réservation",
    "Now choose your destination": "Choisissez maintenant votre destination",
    "Destination selected": "Destination sélectionnée",
    "Destination map preview unavailable": "Aperçu de la carte de destination indisponible",
    "Check the destination pin, then confirm it": "Vérifiez le repère de destination, puis confirmez-le",
    "Confirm the destination pin, then choose your pickup": "Confirmez le repère de destination, puis choisissez votre départ",
    "Place unavailable": "Lieu indisponible",
    "Geocoding unavailable": "Géocodage indisponible",
    "AI map correction unavailable": "Correction de carte par IA indisponible",
    "Route unavailable": "Itinéraire indisponible",
    "Route updated with your stop": "Itinéraire mis à jour avec votre arrêt",
    "Choose your vehicle, stops and pickup time": "Choisissez votre véhicule, vos arrêts et l’heure de départ",
    "Maximum 5 stops": "5 arrêts maximum",
    "Enter stop address": "Saisissez l’adresse de l’arrêt",
    "Ready to request your VASI ride": "Prêt à commander votre trajet VASI",
    "Choose your custom pickup date and time": "Choisissez la date et l’heure de départ",
    "Choose a date and time": "Choisissez une date et une heure",
    "Pickup must be at least 30 minutes from now": "Le départ doit être prévu au moins 30 minutes à l’avance",
    "Custom pickup:": "Départ personnalisé :",
    "Please confirm your custom pickup time": "Confirmez votre heure de départ personnalisée",
    "Could not create ride": "Impossible de créer le trajet",
    "Ride ID missing": "Numéro de trajet manquant",
    "Booking failed": "Échec de la réservation",
    "Please sign in again": "Reconnectez-vous",
    "Payment configuration unavailable": "Configuration du paiement indisponible",
    "Card and Apple Pay are coming soon": "La carte bancaire et Apple Pay seront bientôt disponibles",
    "Payment authorization unavailable": "Autorisation de paiement indisponible",
    "Secure payment could not load": "Le paiement sécurisé n’a pas pu être chargé",
    "Payment could not be prepared": "Le paiement n’a pas pu être préparé",
    "Payment authorization failed": "Échec de l’autorisation du paiement",
    "Payment authorized safely": "Paiement autorisé en toute sécurité",
    "On trip": "Trajet en cours",
    "Trip in progress": "Trajet en cours",
    "Trip completed": "Trajet terminé",
    "Ride cancelled": "Trajet annulé",
    "View cancellation receipt": "Voir le reçu d’annulation",
    "Status unavailable": "Statut indisponible",
    "Cancel this VASI ride? A €5 cancellation fee will be charged.": "Annuler ce trajet VASI ? Des frais d’annulation de 5 € seront facturés.",
    "Cancel this VASI ride? This cancellation is free.": "Annuler ce trajet VASI ? Cette annulation est gratuite.",
    "Cancellation could not be completed": "L’annulation n’a pas pu être effectuée",
    "Confirm this stop is complete?": "Confirmer que cet arrêt est terminé ?",
    "Session missing": "Session manquante",
    "Payment capture pending": "Encaissement du paiement en attente",
    "Enter the 4-digit ride PIN": "Saisissez le code PIN du trajet à 4 chiffres",
    "Ride PIN could not be verified": "Le code PIN du trajet n’a pas pu être vérifié",
    "Mark that you arrived at pickup?": "Indiquer que vous êtes arrivé au point de départ ?",
    "Complete this ride?": "Terminer ce trajet ?",
    "Cash payment due from passenger.": "Paiement en espèces à recevoir du passager.",
    "Card payment captured successfully.": "Paiement par carte encaissé avec succès.",
    "Trip saved. Payment needs review:": "Trajet enregistré. Le paiement doit être vérifié :",
    "Login required": "Connexion requise",
    "Courier service unavailable": "Service livreur indisponible",
    "Your completed Eats earnings will appear here.": "Vos revenus Eats terminés apparaîtront ici.",
    "Stripe is checking your payout information.": "Stripe vérifie vos informations de versement.",
    "Connect and verify your RIB before your first delivery.": "Connectez et vérifiez votre RIB avant votre première livraison.",
    "Navigate to customer": "Naviguer vers le client",
    "Navigate to restaurant": "Naviguer vers le restaurant",
    "Navigate to drop-off": "Naviguer vers la destination",
    "Navigate to pickup": "Naviguer vers le point de départ",
    "Go online for another job.": "Mettez-vous en ligne pour une autre mission.",
    "Waiting for payment": "En attente du paiement",
    "Order received": "Commande reçue",
    "Restaurant accepted": "Acceptée par le restaurant",
    "Preparing your food": "Préparation de votre repas",
    "Ready for courier": "Prête pour le livreur",
    "Courier is on the way": "Le livreur est en route",
    "Order progress": "Suivi de la commande",
    "Document delivery": "Livraison de document",
    "Parcel delivery": "Livraison de colis",
    "Some activity could not be loaded. Please refresh.": "Une partie de l’activité n’a pas pu être chargée. Actualisez la page.",
    "Choose a rating": "Choisir une note",
    "Add feedback (optional)": "Ajouter un commentaire (facultatif)",
    "Driver feedback": "Commentaire sur le chauffeur",
    "Choose 1 to 5 stars first.": "Choisissez d’abord de 1 à 5 étoiles.",
    "This ride has already been rated.": "Ce trajet a déjà été noté.",
    "Rating could not be saved. Please try again.": "Impossible d’enregistrer la note. Réessayez.",
    "Vehicle details unavailable": "Informations du véhicule indisponibles",
    "No rides yet.": "Aucun trajet pour le moment.",
    "No photo": "Aucune photo",
    "Needs changes": "Modifications nécessaires",
    "Admin review": "Vérification administrateur",
    "Accept order": "Accepter la commande",
    "Start preparing": "Commencer la préparation",
    "Ready for pickup": "Prête à être récupérée",
    "Request failed": "Échec de la demande",
    "Own delivery": "Livraison propre",
    "VASI courier": "Livreur VASI",
    "Restaurant performance": "Performance du restaurant",
    "Item name": "Nom de l’article",
    "Allergens, comma separated": "Allergènes, séparés par des virgules",
    "Delivery address unavailable": "Adresse de livraison indisponible",
    "Choose a JPG, PNG or WebP photo.": "Choisissez une photo JPG, PNG ou WebP.",
    "Original photo is too large. Choose one under 8 MB.": "La photo d’origine est trop volumineuse. Choisissez un fichier de moins de 8 Mo.",
    "This photo could not be opened.": "Cette photo n’a pas pu être ouverte.",
    "Photo is still too large after resizing. Choose another photo.": "La photo reste trop volumineuse après redimensionnement. Choisissez-en une autre.",
    "Photo approved and published.": "Photo approuvée et publiée.",
    "Photo needs changes. See the reason below.": "La photo nécessite des modifications. Consultez la raison ci-dessous.",
    "Photo sent for VASI review.": "Photo envoyée à VASI pour vérification.",
    "Menu item added. Photo is optional.": "Article ajouté au menu. La photo est facultative.",
    "Enter a valid email address.": "Saisissez une adresse e-mail valide.",
    "Selfie preview": "Aperçu du selfie",
    "Electric bicycle photo": "Photo du vélo électrique",
    "Scooter photo": "Photo du scooter",
    "Motorcycle photo": "Photo de la moto",
    "Car photo": "Photo de la voiture",
    "Vehicle photo": "Photo du véhicule",
    "Enter your address.": "Saisissez votre adresse.",
    "Add all required documents.": "Ajoutez tous les documents obligatoires.",
    "Each file must be under 10 MB.": "Chaque fichier doit faire moins de 10 Mo.",
    "Take your live selfie.": "Prenez votre selfie en direct.",
    "Sending application…": "Envoi en cours…",
    "try again.": "réessayez.",
  };
  Object.assign(translations.fr, dynamicFrenchTranslations);

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
