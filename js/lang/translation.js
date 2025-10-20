define(['./en', './fr', './override'], function(en, fr, override) {

  var loadTranslations = function(Adapt){
      $.i18n().load({ 'en' : en.loadTranslationFile(Adapt), 'fr' : fr.loadTranslationFile(Adapt) , 'override' : override.loadTranslationFile(Adapt) });
  };

  return {loadTranslations};
});
