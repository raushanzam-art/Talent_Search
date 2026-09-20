# Question CSV Template

The `questions.csv` file is an administrator-editable question template. It is intentionally simple so it can be opened and edited in Excel or another spreadsheet application.

## Columns

| Column | Meaning |
| --- | --- |
| `questionCode` | Unique code for the question, such as `VR-001`. |
| `skill` | Skill name assigned to the question. Use an existing skill name, such as `Verbal Reasoning`. |
| `level` | Expertise level assigned to the question: `Beginner`, `Intermediate`, or `Expert`. |
| `type` | Question type: `MULTIPLE_CHOICE`, `VERBAL`, `NUMERICAL`, `SPATIAL`, `NON_VERBAL`, or `READING`. |
| `difficulty` | Human-readable difficulty, such as `Easy`, `Medium`, or `Hard`. |
| `language` | Language code for the question, such as `en`. |
| `questionText` | The question shown to the candidate. |
| `option1` | First answer option. |
| `score1` | Score for `option1`. |
| `option2` | Second answer option. |
| `score2` | Score for `option2`. |
| `option3` | Third answer option. |
| `score3` | Score for `option3`. |
| `explanation` | Explanation shown after the question is assessed. |

## Mandatory fields

Every column is mandatory for the initial template. Each row must contain:

- A non-empty `questionCode`, `skill`, `level`, `type`, `difficulty`, and `language`.
- A non-empty `questionText` and `explanation`.
- Three non-empty options: `option1`, `option2`, and `option3`.
- A numeric score in `score1`, `score2`, and `score3`.

Do not leave commas unquoted inside a question, option, or explanation. Excel normally handles this automatically when exporting CSV.

## Adding a question

1. Open `questions.csv` in Excel.
2. Add one new row below the existing questions.
3. Fill in every column using the definitions above.
4. Use an existing skill and expertise level name exactly as written in the database.
5. Choose one of the supported question types.
6. Assign scores using the scoring model below.
7. Save or export the file as CSV while keeping the header row unchanged.

There is no CSV importer yet. This file is currently a template for the later import feature.

## Question codes

Question codes must be unique across the entire CSV and database. Use a short skill-based prefix followed by a zero-padded number, for example:

- `VR-001` for Verbal Reasoning
- `NR-001` for Numerical Reasoning
- `RC-001` for Reading Comprehension

When adding another question for the same prefix, continue the sequence instead of reusing an existing code.

## Scoring

Each question has three answer options. The initial scoring model is:

- Least Appropriate = `1`
- Appropriate = `2`
- Most Appropriate = `3`

Enter only the numeric value in each score column. The score belongs to the option in the same numbered column. For example, `score2` is the score for `option2`.

These values belong to the question data and are not hard-coded in the frontend.
