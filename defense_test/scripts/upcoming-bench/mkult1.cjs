const fs=require('fs');
const D=(label,hero,deck,extra={})=>({label,hero,deck,...extra});
const out=[
 D('joker / C덱','joker',['joker','star_boy','snow_rabbit','night_rabbit','siren']),
 D('joker / 섞인 덱','joker',['joker','zeke','luna','jasmine','great_detective']),
 D('underdog / 노멀 5인(발동)','underdog',['underdog','star_boy','snow_rabbit','night_rabbit','silver_rabbit']),
 D('underdog / 섞인 덱(미발동)','underdog',['underdog','zeke','luna','jasmine','great_detective']),
 D('toffee / R+UR','toffee_apple',['toffee_apple','zeke','luna','jasmine','great_detective'],{horizon:40}),
 D('toffee / 노멀 덱','toffee_apple',['toffee_apple','star_boy','snow_rabbit','night_rabbit','siren'],{horizon:40}),
 D('antropy / 디버프 덱','antropy',['antropy','great_detective','frost_witch','flame_sage','phantom']),
 D('antropy / 오라 덱','antropy',['antropy','siren','ancient_dragon','harmonious','time_magician']),
 D('antropy / 노멀 덱','antropy',['antropy','star_boy','snow_rabbit','night_rabbit','siren']),
 D('ash / 화상 덱','ash',['ash','red_dragon','flame_sage','zeke','santa']),
 D('ash / 노멀 덱(재료 많음)','ash',['ash','star_boy','snow_rabbit','night_rabbit','siren']),
 D('ash / UR 덱','ash',['ash','zeke','luna','jasmine','great_detective']),
 D('cure / UR 덱','cure_master',['cure_master','zeke','luna','jasmine','ancient_dragon']),
 D('venom / 독 덱','venom',['venom','mushroom_king','phantom','time_ruler','galaxy_whale']),
 D('venom / 화상 덱','venom',['venom','zeke','red_dragon','flame_sage','cherry_prince']),
 D('venom / 섞인 덱','venom',['venom','luna','jasmine','great_detective','siren']),
];
fs.writeFileSync('ult1.json',JSON.stringify(out));console.log(out.length);
