import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import translationEN from './locales/en.json';
import translationES from './locales/es.json';
import translationPT from './locales/pt.json';
import translationFR from './locales/fr.json';
import translationDE from './locales/de.json';
import translationZH from './locales/zh.json';

const resources = {
    en: { translation: translationEN },
    es: { translation: translationES },
    pt: { translation: translationPT },
    fr: { translation: translationFR },
    de: { translation: translationDE },
    zh: { translation: translationZH }
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'en',
        debug: false,
        interpolation: {
            escapeValue: false // not needed for react as it escapes by default
        }
    });

export default i18n;
