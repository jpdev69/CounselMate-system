*included an LLM feature 'Ollama' with model 'dolphin3' to validate if
'Violation Description' matches the 'Violation Type'

~this works such that the LLM reads the text input, analyze it to store at
huge context vector that similarly captures its literal meaning and constraints.
using this internal representation, the model then generates a response utilizing
probability to select the nearest learned context.

