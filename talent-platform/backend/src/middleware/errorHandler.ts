import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import {
  QuestionConflictError,
  QuestionNotFoundError,
  QuestionReferenceNotFoundError
} from '../questions/questionService';
import {
  EmailAlreadyRegisteredError,
  InactiveUserError,
  InvalidCredentialsError
} from '../modules/auth/auth.service';
import { AssessmentNotFoundError, AssessmentStartError } from '../modules/assessments/assessment.service';
import {
  AttemptCompletedError,
  AttemptNotFoundError,
  AttemptQuestionError,
  DuplicateAnswerError,
  QuestionTimedOutError
} from '../modules/assessments/answer.service';
import { AttemptNotCompletedError } from '../modules/assessments/attemptDetail.service';

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      error: 'Validation failed',
      details: error.flatten()
    });
    return;
  }

  if (error instanceof QuestionNotFoundError) {
    response.status(404).json({ error: error.message });
    return;
  }

  if (error instanceof QuestionConflictError) {
    response.status(409).json({ error: error.message });
    return;
  }

  if (error instanceof QuestionReferenceNotFoundError) {
    response.status(404).json({ error: error.message });
    return;
  }

  if (error instanceof EmailAlreadyRegisteredError) {
    response.status(409).json({ error: error.message });
    return;
  }

  if (error instanceof InvalidCredentialsError || error instanceof InactiveUserError) {
    response.status(401).json({ error: error.message });
    return;
  }

  if (error instanceof AssessmentNotFoundError) {
    response.status(404).json({ error: error.message });
    return;
  }

  if (error instanceof AssessmentStartError) {
    response.status(409).json({ error: error.message });
    return;
  }

  if (error instanceof AttemptNotFoundError) {
    response.status(404).json({ error: error.message });
    return;
  }

  if (error instanceof AttemptQuestionError) {
    response.status(400).json({ error: error.message });
    return;
  }

  if (error instanceof DuplicateAnswerError || error instanceof AttemptCompletedError || error instanceof AttemptNotCompletedError) {
    response.status(409).json({ error: error.message });
    return;
  }

  if (error instanceof QuestionTimedOutError) {
    response.status(408).json({ error: error.message, data: error.timeout });
    return;
  }

  console.error(error);
  response.status(500).json({ error: 'Internal server error' });
};
