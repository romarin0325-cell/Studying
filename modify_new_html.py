
def modify_file():
    with open('new.html', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Level Cap
    content = content.replace('function getMaxLevel() {\n    return 25 + getCycleCount();\n}',
                              'function getMaxLevel() {\n    return 30;\n}')

    # 2. Artifact Slot
    content = content.replace('if([5, 10, 15, 20, 25].includes(player.level))',
                              'if([5, 10, 15, 20, 25, 30].includes(player.level))')

    # 3. Shop Label
    shop_search = "if(sk.type === 'mag') typeStr = \"<span style='color:#90caf9; font-size:0.7rem;'>[마법]</span> \";"
    shop_replace = shop_search + "\n        if(sk.type === 'sup') typeStr = \"<span style='color:#a5d6a7; font-size:0.7rem;'>[보조]</span> \";"
    content = content.replace(shop_search, shop_replace)

    # 4. Turn Log Position
    # Remove old log line
    content = content.replace("    log(`<div class=\"log-turn\">=== Turn ${turnCount} ===</div>`);", "")
    # Add to top of executeTurn
    exec_search = "function executeTurn(skillKey) {\n    if(!player || !currentEnemy) return;"
    exec_replace = exec_search + "\n\n    log(`<div class=\"log-turn\">=== Turn ${turnCount} ===</div>`);"
    content = content.replace(exec_search, exec_replace)

    # 5. Shield Logs
    # Note: Using precise search based on read_file output
    content = content.replace("if(buffs.player.nullMag && type === 'mag') dmg = 0;",
                              "if(buffs.player.nullMag && type === 'mag') { log(\"매직 가드로 마법 공격을 무효화했습니다!\", 'info'); dmg = 0; }")
    content = content.replace("if(buffs.player.nullPhy && type === 'phy') dmg = 0;",
                              "if(buffs.player.nullPhy && type === 'phy') { log(\"배리어로 물리 공격을 무효화했습니다!\", 'info'); dmg = 0; }")

    # 6. Enemy Attack Logs
    # flame_sage
    fs_search = "return applyEnemyDamage(currentEnemy.atk, 'phy');\n    }\n\n    if(currentEnemy.ai === 'lightning_sage')"
    fs_replace = "log(`${currentEnemy.name}의 공격`, 'phy');\n        return applyEnemyDamage(currentEnemy.atk, 'phy');\n    }\n\n    if(currentEnemy.ai === 'lightning_sage')"
    content = content.replace(fs_search, fs_replace)

    # lightning_sage
    ls_search = "return applyEnemyDamage(currentEnemy.atk, 'phy');\n    }\n\n    if(currentEnemy.ai === 'artificial_god')"
    ls_replace = "log(`${currentEnemy.name}의 공격`, 'phy');\n        return applyEnemyDamage(currentEnemy.atk, 'phy');\n    }\n\n    if(currentEnemy.ai === 'artificial_god')"
    content = content.replace(ls_search, ls_replace)

    # artificial_god
    ag_search = "return applyEnemyDamage(currentEnemy.atk, 'phy');\n    }\n\n    if(currentEnemy.ai === 'red_dragon')"
    ag_replace = "log(`${currentEnemy.name}의 공격`, 'phy');\n        return applyEnemyDamage(currentEnemy.atk, 'phy');\n    }\n\n    if(currentEnemy.ai === 'red_dragon')"
    content = content.replace(ag_search, ag_replace)

    # 7. Iris Balance of Scales Log
    # Using a larger block to ensure we are in the right place
    iris_search = """                if(pRatio >= 0.8) {
                    mult = 5.0;
                    msg = "균형의 천칭 (심판)";
                }"""
    iris_replace = """                if(pRatio >= 0.8) {
                    mult = 5.0;
                    msg = "균형의 천칭 (심판)";
                    log("플레이어 체력이 80% 이상이어 강력한 피해를 입습니다!", 'info');
                }"""
    content = content.replace(iris_search, iris_replace)

    with open('new.html', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == "__main__":
    modify_file()
