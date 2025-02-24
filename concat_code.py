import os

import fnmatch

from datetime import datetime



def should_include_file(filename, output_filename):

    # Files to exclude

    exclude_patterns = [

        output_filename,          # The output file itself

        '.*',                     # Hidden files

        '*node_modules*',         # Node modules

        '*.pyc',                  # Python cache files

        '*.git*',                 # Git related files

        '*.log',                  # Log files

        '*.md',                   # Markdown files

        '*.txt',                  # Text files (to avoid including previous outputs)

        '*.json',                 # JSON files (usually configs)

        '*.lock',                 # Lock files

        '*__pycache__*',         # Python cache directory

        '*.env*',                # Environment files

        '*venv*',                # Virtual environment files

        '*dist*',                # Distribution directories

        '*build*'                # Build directories

    ]

    

    # Check if file matches any exclude pattern

    for pattern in exclude_patterns:

        if fnmatch.fnmatch(filename, pattern):

            return False

            

    return True



def get_file_extension(filename):

    """Returns the file extension without the dot"""

    return os.path.splitext(filename)[1][1:].lower()



def is_code_file(filename):

    """Determines if a file is a code file based on its extension"""

    code_extensions = {

        'py', 'js', 'jsx', 'ts', 'tsx', 'java', 'cpp', 'c', 'hpp', 'h',

        'css', 'scss', 'sass', 'less', 'html', 'php', 'rb', 'go', 'rs',

        'swift', 'kt', 'scala', 'sql', 'sh', 'bash', 'ps1', 'r', 'vue',

        'cs', 'fs', 'f90', 'f95', 'f03', 'perl', 'pl', 'lua'

    }

    return get_file_extension(filename) in code_extensions



def concatenate_code_files(root_dir, output_filename):

    """

    Concatenates all code files in the directory tree into a single file

    with headers showing the relative path of each file

    """

    try:

        with open(output_filename, 'w', encoding='utf-8') as outfile:

            # Write header with timestamp

            outfile.write(f"Code Concatenation - Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

            outfile.write("=" * 80 + "\n\n")

            

            # Walk through directory tree

            for dirpath, dirnames, filenames in os.walk(root_dir):

                # Skip excluded directories

                dirnames[:] = [d for d in dirnames if should_include_file(d, output_filename)]

                

                # Process each file

                for filename in filenames:

                    if should_include_file(filename, output_filename) and is_code_file(filename):

                        filepath = os.path.join(dirpath, filename)

                        rel_path = os.path.relpath(filepath, root_dir)

                        

                        try:

                            with open(filepath, 'r', encoding='utf-8') as infile:

                                # Write file header

                                outfile.write(f"File: {rel_path}\n")

                                outfile.write("-" * len(f"File: {rel_path}") + "\n\n")

                                

                                # Write file contents

                                content = infile.read()

                                outfile.write(content)

                                

                                # Add spacing between files

                                outfile.write("\n\n" + "=" * 80 + "\n\n")

                        except Exception as e:

                            outfile.write(f"Error reading file {rel_path}: {str(e)}\n\n")

                            continue

            

        print(f"Successfully concatenated code files to {output_filename}")

        return True

    except Exception as e:

        print(f"Error during concatenation: {str(e)}")

        return False



if __name__ == "__main__":

    # Configuration

    ROOT_DIR = "."  # Current directory

    OUTPUT_FILE = "concatenated_code.txt"

    

    concatenate_code_files(ROOT_DIR, OUTPUT_FILE)