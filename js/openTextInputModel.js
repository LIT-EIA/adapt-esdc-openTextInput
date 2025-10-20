define([
    'core/js/adapt',
    'core/js/models/questionModel',
    'core/js/enums/buttonStateEnum'
], function(Adapt, QuestionModel, BUTTON_STATE) {

    var OpenTextInputModel = QuestionModel.extend({
      markQuestion: function() {
        if (this.isCorrect()) {
          this.set('_isCorrect', true);
        } else {
          this.set('_isCorrect', false);
        }
      },

      setScore: function() {},

      checkQuestionCompletion: function() {

        var isComplete = (this.get('_isCorrect') || this.get('_attemptsLeft') === 0);

        if (isComplete) {
          this.setCompletionStatus();
        }

        return isComplete;

      },

      isCorrect: function() {
        var modelAnswer = this.get('modelAnswer');
        var userAnswer = this.get('_userAnswer');
        return userAnswer === modelAnswer;
      },

      updateButtons: function() {

        var isInteractionComplete = this.get('_isInteractionComplete');
        var isCorrect = this.get('_isCorrect');
        var isEnabled = this.get('_isEnabled');
        var buttonState = this.get('_buttonState');
        var canShowModelAnswer = this.get('_canShowModelAnswer');

        if (isInteractionComplete) {

          if (isCorrect || !canShowModelAnswer) {
            // Use correct instead of complete to signify button state
            this.set('_buttonState', BUTTON_STATE.CORRECT);

          } else {

            switch (buttonState) {
              case BUTTON_STATE.SUBMIT:
              case BUTTON_STATE.HIDE_CORRECT_ANSWER:
                this.set('_buttonState', BUTTON_STATE.SHOW_CORRECT_ANSWER);
                break;
              default:
                this.set('_buttonState', BUTTON_STATE.HIDE_CORRECT_ANSWER);
            }

          }

        } else {

          if (isEnabled) {
            this.set('_buttonState', BUTTON_STATE.SUBMIT);
          } else {
            this.set('_buttonState', BUTTON_STATE.RESET);
          }
        }

      },

      setQuestionAsSubmitted: function() {
        this.set({
          _isEnabled: false,
          _isSubmitted: true
        });
      },

      setupFeedback: function() {
        if (!this.has('_feedback')) return;

        this.setupCorrectFeedback()
      },

      setupCorrectFeedback: function() {
        this.set({
          feedbackTitle: this.getFeedbackTitle(),
          feedbackMessage: this.get('_feedback')
        });
      },

      setupPartlyCorrectFeedback: function() {
        var feedback = this.get('_feedback');

        this.setAttemptSpecificFeedback(feedback);
      },

      setupIncorrectFeedback: function() {
        this.setAttemptSpecificFeedback(this.get('_feedback'));
      },

      setAttemptSpecificFeedback: function(feedback) {
        this.set({
          feedbackTitle: this.getFeedbackTitle(),
          feedbackMessage: feedback
        });
      },
    });

    return OpenTextInputModel;

});
