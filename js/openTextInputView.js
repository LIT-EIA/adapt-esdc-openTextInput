define([
  'core/js/adapt',
  'core/js/views/questionView',
  'core/js/enums/buttonStateEnum',
  'core/js/views/buttonsView'
], function(Adapt, QuestionView, BUTTON_STATE, ButtonsView) {

  var trimString = function (s) {
    if (typeof String.prototype.trim !== 'function') {
      String.prototype.trim = function() {
        return this.replace(/^\s+|\s+$/g, '');
      }
    }
    var result = s ? s.trim() : '';
    return result;
  }

  var OpenTextInputView = QuestionView.extend({

    events: {
      'keyup .openTextInput-item-textbox': 'onKeyUpTextarea',
      'focusin .openTextInput-item-textbox': 'onFocusInTextarea',
      'focusout .openTextInput-item-textbox': 'onFocusOutTextarea'
    },

    formatPlaceholder: function() {
      // Replace quote marks in placholder.
      var placeholder = this.model.get('placeholder') || '';
      
      placeholder = placeholder.replace(/"/g, "'");

      this.model.set('placeholder', placeholder);
    },

    setupQuestion: function() {
      this.listenTo(this.model, 'change:_isComplete', this.onCompleteChanged);

      this.model.set('_canShowFeedback', true);
      this.model.set('_feedback', {});

      this.formatPlaceholder();

      if (!this.model.get('_userAnswer')) {
        var userAnswer = this.getUserAnswer();
        if (userAnswer) {          
          this.model.set('_userAnswer', userAnswer);
        }
      }

      var modelAnswer = this.model.get('modelAnswer');

      modelAnswer = modelAnswer ? modelAnswer.replace(/\\n|&#10;/g, '\n') : '';

      this.model.set('modelAnswer', modelAnswer);

      if (this.model.get('_isComplete')) {
        this._runModelCompatibleFunction("setQuestionAsSubmitted");
        if (this.model.get('_canShowModelAnswer')) {          
          this.model.set('_buttonState', BUTTON_STATE.SHOW_CORRECT_ANSWER);
        } else {
          this.model.set('_buttonState', BUTTON_STATE.CORRECT);
        }
      } else {
        this.model.set('_buttonState', BUTTON_STATE.SUBMIT);
      }

      // Some shim code to handle old/missing JSON.
      var buttons = this.model.get('_buttons');

      if (buttons['_hideCorrectAnswer'] == undefined) {
        buttons._hideCorrectAnswer = buttons._showUserAnswer || 'Show User Answer';
      }

      if (buttons['_showCorrectAnswer'] == undefined) {
        buttons._showCorrectAnswer = buttons._showModelAnswer || 'Show Model Answer'
      }      

      this.model.set('_buttons', buttons);
    },

    onCompleteChanged: function(model, isComplete, buttonState) {      
      var textboxValue = this.$textbox.val();
      this.$textbox.prop('disabled', isComplete);
      var parent = this.$el.find('.buttons-cluster');      
      var action = parent.find('.buttons-action');
      if(trimString(textboxValue) !== ''){
        parent.prepend(`<button class="aria-hidden disabled button-margin" aria-hidden="true" disabled>${action.text()}</button>`);
        action.attr('aria-hidden', true).addClass('display-none');
      }

      if (isComplete) {        
        if (model.get('_canShowModelAnswer')) {          
          // Keep the action button enabled so we can show the model answer.
          this.$('.buttons-action').a11y_cntrl_enabled(true);

          if (!_.isEmpty(buttonState)) {
            // Toggle the button.            
            if (buttonState == BUTTON_STATE.CORRECT || buttonState == BUTTON_STATE.HIDE_CORRECT_ANSWER || buttonState == BUTTON_STATE.SUBMIT) {
              this.model.set('_buttonState', BUTTON_STATE.SHOW_CORRECT_ANSWER);
            } else {
              this.model.set('_buttonState', BUTTON_STATE.HIDE_CORRECT_ANSWER);
            }
          }
        }
      }
    },

    onSubmitClicked: function() {
      var canSubmit = this._runModelCompatibleFunction("canSubmit");

      if(!canSubmit) {
          this.showInstructionError();
          this.onCannotSubmit();
          return;
      }

      this.model.set('_canShowFeedback', true);
      this.model.set('_isComplete', true);
      this.model.set('_isInteractionComplete', true);
      this.model.set('_canShowModelAnswer', true);
      this._runModelCompatibleFunction("setQuestionAsSubmitted");
      this.removeInstructionError();
      this.storeUserAnswer();
      this._runModelCompatibleFunction("markQuestion", "isCorrect");
      this._runModelCompatibleFunction("setScore");
      this.showMarking();
      this._runModelCompatibleFunction("checkQuestionCompletion");

      this.recordInteraction();
      this._runModelCompatibleFunction("setupFeedback");
      $(window).resize();
      this._runModelCompatibleFunction("updateButtons");
      this.showFeedback();
      this.onSubmitted();
  },

    canSubmit: function() {
      var answer = this.model.get('_userAnswer');

      return trimString(answer) !== '';
    },

    isCorrect: function() {      
      return this.canSubmit();
    },

    onCannotSubmit: function() {  },

    onQuestionRendered: function() {
      this.listenTo(this.buttonsView, 'buttons:stateUpdate', this.onActionClicked);

      if (this.$textbox === undefined) {
        this.$textbox = this.$('textarea.openTextInput-item-textbox');
      }

      this.$modelAnswer = this.$('.openTextInput-item-modelanswer');
      this.$countChars = this.$('.openTextInput-count-characters-container');

      this.$autosave = this.$('.openTextInput-autosave');
      this.$autosave.text(this.model.get('savedMessage'));

      this.$autosave.css({opacity: 0});

      this.countCharacters();
      this.setReadyStatus();

      if (this.model.get('_isComplete') && !this.model.get('_canShowModelAnswer')) {
        // Model answer has been disabled.
        // Force setting the correct/submitted state.        
        this.model.set('_buttonState', BUTTON_STATE.CORRECT);
        this.$('.buttons-action').a11y_cntrl_enabled(false);
        this.$textbox.prop('disabled', true);
      }
    },

    getUserAnswer: function() {
      var identifier = this.model.get('_id') + '-OpenTextInput-UserAnswer';
      var userAnswer = '';

      if (this.supportsHtml5Storage() && !this.model.get('_isResetOnRevisit')) {
        userAnswer = localStorage.getItem(identifier);   
             
        if (userAnswer) {
          return userAnswer;
        }
      }

      return false;
    },

    supportsHtml5Storage: function() {
      // check for html5 local storage support
      
      try {
        return 'localStorage' in window && typeof window['localStorage'] !== 'undefined';
      } catch (e) {
        return false;
      }
    },

    countCharacters: function() {
      var charLengthOfTextarea = this.$textbox.val() ? trimString(this.$textbox.val()).length : 0;
      var allowedCharacters = this.model.get('_allowedCharacters');
      if (allowedCharacters != null) {
        var charactersLeft = allowedCharacters - charLengthOfTextarea;
        this.$('.openTextInput-count-amount').html(charactersLeft);
      } else {
        this.$('.openTextInput-count-amount').html(charLengthOfTextarea);
      }
    },

    onKeyUpTextarea: _.throttle(function() {
      this.limitCharacters();
      var text = this.$textbox.val();

      if (trimString(text) !== '') {
        this.model.set('_userAnswer', text);
        this.countCharacters();

        if (this.saveTimeout) {
          clearTimeout(this.saveTimeout);
        }

        var self = this;
        this.saveTimeout = setTimeout(function() {
          self.storeUserAnswer();
        }, 2000);
      }

    }, 300),

    onFocusInTextarea: function() {
      this.$countChars.attr('aria-live', 'polite');
    },

    onFocusOutTextarea: function() {
      this.$countChars.removeAttr('aria-live');
    },

    limitCharacters: function() {
      var allowedCharacters = this.model.get('_allowedCharacters');
      if (allowedCharacters != null && this.$textbox.val().length > allowedCharacters) {
        var substringValue = this.$textbox.val().substring(0, allowedCharacters);
        this.$textbox.val(substringValue);
      }
    },

    storeUserAnswer: function() {
      // Use unique identifier to avoid collisions with other components
      var identifier = this.model.get('_id') + '-OpenTextInput-UserAnswer';

      if (this.supportsHtml5Storage() && !this.model.get('_isResetOnRevisit')) {
        // Adding a try-catch here as certain browsers, e.g. Safari on iOS in Private mode,
        // report as being able to support localStorage but fail when setItem() is called.
        try {          
          localStorage.setItem(identifier, this.model.get('_userAnswer'));
        } catch (e) {
          console.log('ERROR: HTML5 localStorage.setItem() failed! Unable to save user answer.');
        }
      }

      this.model.set('_isSaved', true);      

      this.$autosave.css({opacity: 100});
      this.$autosave.delay(1000).animate({opacity: 0});
    },

    updateActionButton: function(buttonText) {
      // Keep the action button enabled so we can show the model answer
      this.$('.buttons-action').a11y_cntrl_enabled(true);      

      this.$('.openTextInput-action-button').html(buttonText);
    },

    postRender: function() {
      // add aria-labelledby for textarea
      let olabel = this.model.get('_id') + '-OpenTextInput-InstructionID'
      this.$('.openTextInput-instruction-inner').attr('id', olabel);
      this.$('.openTextInput-answer-container textarea').attr('aria-labelledby', olabel);
      this.$('.openTextInput-instruction-inner').removeAttr('role');
      this.$('.openTextInput-instruction-inner').removeAttr('aria-live');
      
      if (this.$('.openTextInput-item-modelanswer').height() <= 0) {
        this.$('.openTextInput-item-textbox, .openTextInput-count-characters').css('height', 'auto');
      } else {
        // Set the height of the textarea to the height of the model answer.
        // This creates a smoother user experience
        this.$('.openTextInput-item-textbox').height(this.$('.openTextInput-item-modelanswer').height());
        this.$('.openTextInput-count-characters').height(this.$('.openTextInput-count-characters').height());
      }

      this.$('.openTextInput-item-modelanswer').addClass('hide-openTextInput-modelanswer');

      QuestionView.prototype.postRender.call(this);
    },

    showCorrectAnswer: function() {
      this.model.set('_buttonState', BUTTON_STATE.HIDE_CORRECT_ANSWER);
      this.updateActionButton(this.model.get('_buttons').showUserAnswer);

      this.$textbox.hide();
      this.$countChars.hide();
      this.$modelAnswer.addClass('show-openTextInput-modelanswer').removeClass('hide-openTextInput-modelanswer');

      this.scrollToTextArea();
    },

    hideCorrectAnswer: function() {
      this.model.set('_buttonState', BUTTON_STATE.SHOW_CORRECT_ANSWER);
      this.updateActionButton(this.model.get('_buttons').showModelAnswer);

      if (this.$textbox === undefined) {
        this.$textbox = this.$('textarea.openTextInput-item-textbox');
      }

      if (this.$modelAnswer === undefined) {
        this.$modelAnswer = this.$('.openTextInput-item-modelanswer');
      }

      this.$textbox.val(this.model.get('_userAnswer')).show();

      if (this.$countChars === undefined) {
        this.$countChars = this.$('.openTextInput-count-characters-container');
      }

      this.$countChars.show();
      this.$modelAnswer.addClass('hide-openTextInput-modelanswer').removeClass('show-openTextInput-modelanswer');
    },

    scrollToTextArea: function() {
      // Smooth scroll to top of TextArea      
      Adapt.scrollTo(this.$('.openTextInput-widget'), {
        duration: 400,
        offset: -parseInt($('#wrapper').css('padding-top'))
      });
    },

    /**
     * Used by adapt-contrib-spoor to get the user's answers in the format required by the cmi.interactions.n.student_response data field
     */
    getResponse: function() {
      var userAnswer = this.model.get('_userAnswer') || '';
      return trimString(userAnswer);
    },

    /**
     * Used by adapt-contrib-spoor to get the type of this question in the format required by the cmi.interactions.n.type data field
     */
    getResponseType: function() {
      return 'fill-in';
    },

    getInteractionObject: function() {
      
      return {
        correctResponsesPattern: [
          this.model.get('modelAnswer')
        ]
      };
    },

    checkIfResetOnRevisit: function() {
      var isResetOnRevisit = this.model.get('_isResetOnRevisit');

      if (isResetOnRevisit) {

        this.model.reset(isResetOnRevisit, true);

        _.defer(_.bind(function() {          
          this.resetQuestionOnRevisit(isResetOnRevisit);
        }, this));

      } else {

        var isInteractionComplete = this.model.get('_isInteractionComplete');

        if (isInteractionComplete) {

          this.model.set('_buttonState', BUTTON_STATE.HIDE_CORRECT_ANSWER);
          _.defer(_.bind(function() {            
            this.onHideCorrectAnswerClicked();
          }, this));

        } else {
          this.model.set('_buttonState', BUTTON_STATE.SUBMIT);
          _.defer(_.bind(function() {
            this.onResetClicked();
          }, this));
        }

      }

    },

    addButtonsView: function() {      
      this.buttonsView = new ButtonsView({model: this.model, el: this.$('.buttons')});

      this.listenTo(this.buttonsView, 'buttons:stateUpdate', this.onButtonStateUpdate);

    },

    onButtonStateUpdate: function(button_state) {
      switch (button_state) {
        case BUTTON_STATE.SUBMIT:
          this.onSubmitClicked();
          break;
        case BUTTON_STATE.RESET:
          this.onResetClicked();
          break;
        case BUTTON_STATE.SHOW_CORRECT_ANSWER:
          this.onShowCorrectAnswerClicked();
          break;
        case BUTTON_STATE.HIDE_CORRECT_ANSWER:
          this.onHideCorrectAnswerClicked();
          break;
        case BUTTON_STATE.SHOW_FEEDBACK:          
          this.showFeedback();
          break;
      }

    },

    showFeedback: function() {      
      Adapt.trigger('notify:popup', {
        title: $.i18n.translate('adapt-a11y-feedback'),
        body: this.model.get('modelAnswer')
      });
    },

    refresh: function() {      
      this.model.set('_buttonState', this.model.getButtonState());

      if (this.model.get('_canShowMarking') && this.model.get('_isInteractionComplete') && this.model.get('_isSubmitted')) {
        this.showMarking();
      }

      if (this.buttonsView) {
        _.defer(_.bind(this.buttonsView.refresh, this.buttonsView));
      }
    },

    /**
     * Used by questionView. Clears the models on Revisit userAnswer so input appears blank
     */
    resetQuestionOnRevisit: function() {      
      this.resetQuestion();
    },

    /**
     * Used by questionView. Clears the models userAnswer onResetClicked so input appears blank
     */
    resetQuestion: function() {      
      this.model.set('_userAnswer', '');

      if (this.$textbox === undefined) {
        this.$textbox = this.$('textarea.openTextInput-item-textbox');
      }

      this.$textbox.val(this.model.get('_userAnswer'));
    }
  });

  return OpenTextInputView;
})