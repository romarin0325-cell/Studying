import sys

def main():
    try:
        with open('card/index.html', 'r', encoding='utf-8') as f:
            content = f.read()

        # Replace angle brackets with full-width versions
        new_content = content.replace('<', '＜').replace('>', '＞')

        with open('card/분석용test.txt', 'w', encoding='utf-8') as f:
            f.write(new_content)

        print("Successfully updated card/분석용test.txt")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
