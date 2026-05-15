"""
Shuffle Case Structuring drill answers
"""
import json
import random
import shutil
from pathlib import Path

def shuffle_case_structuring_drills():
    file_path = Path('/app/backend/routes/ai_drills.py')
    backup_path = file_path.with_suffix('.py.backup')
    
    # Backup
    shutil.copy(file_path, backup_path)
    print(f"✅ Backup created: {backup_path}\n")
    
    # Read file
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    modified_lines = []
    questions_shuffled = 0
    in_case_structuring = False
    
    for line in lines:
        # Check if we're entering case_structuring section
        if '"case_structuring": {' in line:
            in_case_structuring = True
            modified_lines.append(line)
            continue
        
        # Check if we're leaving case_structuring section
        if in_case_structuring and ('"charts_exhibits":' in line or '# Drill generation' in line):
            in_case_structuring = False
        
        # If we're in case_structuring and this line has a multiple choice question
        if in_case_structuring and '"type": "multiple_choice"' in line and '"options":' in line and '"correct_index":' in line:
            try:
                # Extract the question dict using basic string manipulation
                # Find the options array
                options_start = line.find('"options": [')
                if options_start == -1:
                    modified_lines.append(line)
                    continue
                
                options_end = line.find(']', options_start)
                correct_idx_start = line.find('"correct_index": ', options_end)
                correct_idx_end = line.find(',', correct_idx_start)
                
                # Get the old correct index
                old_idx_str = line[correct_idx_start:correct_idx_end].split(': ')[1].strip()
                old_idx = int(old_idx_str)
                
                # Extract options string
                options_str = line[options_start + 12:options_end]  # 12 = len('"options": [')
                
                # Parse options (simple CSV split considering quotes)
                options = []
                current_opt = ""
                in_quotes = False
                for char in options_str:
                    if char == '"' and (not current_opt or current_opt[-1] != '\\'):
                        in_quotes = not in_quotes
                    elif char == ',' and not in_quotes:
                        if current_opt.strip():
                            options.append(current_opt.strip().strip('"'))
                        current_opt = ""
                        continue
                    current_opt += char
                if current_opt.strip():
                    options.append(current_opt.strip().strip('"'))
                
                if len(options) < 2 or old_idx >= len(options):
                    modified_lines.append(line)
                    continue
                
                # Get correct answer
                correct_answer = options[old_idx]
                
                # Shuffle
                indices = list(range(len(options)))
                random.shuffle(indices)
                shuffled_options = [options[i] for i in indices]
                new_idx = shuffled_options.index(correct_answer)
                
                # Rebuild options string
                new_options_str = ', '.join(f'"{opt}"' for opt in shuffled_options)
                
                # Rebuild line
                new_line = line[:options_start + 12] + new_options_str + line[options_end:]
                new_line = new_line.replace(f'"correct_index": {old_idx}', f'"correct_index": {new_idx}')
                
                modified_lines.append(new_line)
                questions_shuffled += 1
                
            except Exception as e:
                print(f"⚠️  Skipped one question due to parsing error: {str(e)}")
                modified_lines.append(line)
        else:
            modified_lines.append(line)
    
    # Write back
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(modified_lines)
    
    print(f"✅ Shuffled {questions_shuffled} Case Structuring questions")
    print(f"✅ File updated: {file_path}\n")
    print("🔄 Restart backend:")
    print("   sudo supervisorctl restart backend")
    
    return questions_shuffled

if __name__ == "__main__":
    print("🔀 Shuffling Case Structuring Answers\n" + "="*60 + "\n")
    count = shuffle_case_structuring_drills()
    print("\n" + "="*60)
    print(f"✅ Complete! {count} questions shuffled.")
