"""
Script to shuffle answer options in Case Structuring drills
to prevent answer pattern recognition
"""
import re
import random
import shutil
from pathlib import Path

def shuffle_answers_in_file():
    """Shuffle the answer options for all case_structuring drills"""
    
    file_path = Path('/app/backend/routes/ai_drills.py')
    
    # Backup the original file
    backup_path = file_path.with_suffix('.py.backup')
    shutil.copy(file_path, backup_path)
    print(f"✅ Created backup: {backup_path}")
    
    # Read the file
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Find the case_structuring section
    cs_start_marker = '"case_structuring": {'
    cs_start = content.find(cs_start_marker)
    
    if cs_start == -1:
        print("❌ Could not find case_structuring section")
        return False
    
    # Find where case_structuring section ends (next major section)
    # Look for the next drill type definition
    cs_end = content.find('"charts_exhibits":', cs_start)
    if cs_end == -1:
        cs_end = len(content)
    
    # Extract the case_structuring section
    before_cs = content[:cs_start]
    cs_section = content[cs_start:cs_end]
    after_cs = content[cs_end:]
    
    # Pattern to match a complete question with options
    question_pattern = r'(\{"id": "q\d+", "type": "multiple_choice", "question": ".*?", "options": )(\[.*?\])(, "correct_index": )(\d+)(, "correct_answer": )"(.*?)"(, "explanation":.*?\})'
    
    questions_shuffled = 0
    
    def shuffle_question(match):
        nonlocal questions_shuffled
        
        prefix = match.group(1)
        options_str = match.group(2)
        correct_idx_prefix = match.group(3)
        old_correct_idx = int(match.group(4))
        correct_ans_prefix = match.group(5)
        old_correct_answer = match.group(6)
        suffix = match.group(7)
        
        # Parse the options array
        # Remove brackets and split by commas, being careful with quotes
        options_str_clean = options_str.strip('[]')
        
        # Simple parsing for quoted strings
        options = []
        current = ""
        in_quotes = False
        escape = False
        
        for char in options_str_clean:
            if escape:
                current += char
                escape = False
                continue
            if char == '\\':
                escape = True
                current += char
                continue
            if char == '"':
                in_quotes = not in_quotes
                current += char
                continue
            if char == ',' and not in_quotes:
                if current.strip():
                    options.append(current.strip().strip('"'))
                current = ""
                continue
            current += char
        
        if current.strip():
            options.append(current.strip().strip('"'))
        
        if len(options) < 2:
            return match.group(0)  # Skip if parsing failed
        
        # Store the correct answer
        if old_correct_idx >= len(options):
            return match.group(0)  # Skip if index is invalid
        
        correct_answer = options[old_correct_idx]
        
        # Create index mapping for shuffling
        indices = list(range(len(options)))
        random.shuffle(indices)
        
        # Shuffle the options
        shuffled_options = [options[i] for i in indices]
        
        # Find new index of correct answer
        new_correct_idx = shuffled_options.index(correct_answer)
        
        # Build the new question string
        options_array_str = '[' + ', '.join(f'"{opt}"' for opt in shuffled_options) + ']'
        
        new_question = (
            f'{prefix}{options_array_str}{correct_idx_prefix}'
            f'{new_correct_idx}{correct_ans_prefix}"{correct_answer}"{suffix}'
        )
        
        questions_shuffled += 1
        return new_question
    
    # Apply shuffling to all questions in case_structuring section
    cs_section_shuffled = re.sub(question_pattern, shuffle_question, cs_section, flags=re.DOTALL)
    
    # Reconstruct the file
    new_content = before_cs + cs_section_shuffled + after_cs
    
    # Write back
    with open(file_path, 'w') as f:
        f.write(new_content)
    
    print(f"\n✅ Shuffled {questions_shuffled} Case Structuring questions")
    print(f"✅ Updated file: {file_path}")
    print(f"\n💾 Original backup saved at: {backup_path}")
    print(f"\n🔄 Restart the backend to apply changes:")
    print(f"   sudo supervisorctl restart backend")
    
    return True

if __name__ == "__main__":
    print("🔀 Shuffling Case Structuring drill answers...")
    print("=" * 60)
    
    success = shuffle_answers_in_file()
    
    if success:
        print("\n" + "=" * 60)
        print("✅ Answer shuffling complete!")
        print("\nThe correct answers are now randomly distributed across A, B, C, D")
        print("instead of being concentrated in option A.")
    else:
        print("\n❌ Shuffling failed. Check the errors above.")
