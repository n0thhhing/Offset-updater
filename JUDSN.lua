local proplamlibcpp = 'libil2cpp.so'
local proplamlibcppstart = 'libil2cpp.so[2].start'
local lib = proplamlibcpp 
local TargetLib = proplamlibcppstart
local dev = "the jewson team"
local version = "23.7.2"
local imdev = true 

------------------------------------------------------------------------------

--table to string
function tableToString(tbl)
    local str = ""
    local comma = false
    for k, v in pairs(tbl) do
        if comma then
            str = str .. "\n"
        end
        if type(k) == "number" then
            str = str .. "[" .. k .. "]=" .. tostring(v)
        else
            str = str .. k .. ": " .. tostring(v)
        end
        comma = true
    end
    str = str .. ""
    return str
end


------------------------------------------------------------------------------

--patcher--
function Patch(lib,offset, hex)
local ms = ""
if tabl0001 == nil then
tabl0001 = {}
end
    local targetAddr = 0
    local hexStrCount = #hex:gsub("%s+", "") --remove spaces between hex
   if hexStrCount%2~=0 then return print("Check your hex again. Something wrong there") end --hexs must be even number. not odd.
    local hexCount = hexStrCount/2
    for i, v in ipairs(gg.getRangesList(lib)) do
        if v.type:sub(3,3) == "x" then targetAddr=v.start+offset break end 
    end
    local editHex = {}
     local ed = {}
    for i=1, hexCount do
        editHex[i] = {address=targetAddr+(i-1), flags=gg.TYPE_BYTE}
      end
 gg.loadResults(editHex)
local res = gg.getResults(gg.getResultsCount())
for i in ipairs(res) do
ms = string.format("%x",res[i].value)
ms = string.upper(ms)
ms = ms:gsub("FFFFFFFFFFFFFF","")
if ms == "0" then 
ms = ms:gsub("0","00")
end
if #ms == 1 then 
ms = "0"..ms
end
ed[i] = ms
end
ms = table.concat(ed)
ms = "h"..ms
      lob = #tabl0001 + 1
      oft = #tabl0001 + 2
      eiz = #tabl0001 + 3
    tabl0001[lob] = lib
    tabl0001[oft] = offset
    tabl0001[eiz] = ms
    gg.loadResults(editHex)
    gg.getResults(hexCount)
    gg.editAll("h"..hex, gg.TYPE_BYTE)
    gg.clearResults()
  end

------------------------------------------------------------------------------

--revert--
function Restore(lib,offset)
for i = 1,#tabl0001 do
if tabl0001[i] == lib and tabl0001[i + 1] == offset then
 edi = tabl0001[i + 2]
 hex = #tabl0001[i + 2] - 1
end end
for i, v in ipairs(gg.getRangesList(lib)) do
  if v.type:sub(3,3) == "x" then targetAddr=v.start+offset break end 
   end
    local editHex = {}
     local ed = {}
hex = hex/2
    for i=1, hex do
        editHex[i] = {address=targetAddr+(i-1), flags=gg.TYPE_BYTE}
    end
  gg.loadResults(editHex)      
  gg.getResults(gg.getResultsCount())
  gg.editAll(edi,1)
  gg.clearResults()
end

------------------------------------------------------------------------------

--main exit
function exit() 
gg.processResume() 
gg.getListItems()
gg.clearList()
gg.clearResults()
gg.toast("[EXIT]")
gg.setVisible(true) 
os.exit()
return 
end 

-----------------------------------------

--menu option definitives--
ON="[✔]" OFF="[✘]" NULL="[-]" IMP="[?]" HUH="[!]" 

--misc--
questions=HUH
important=IMP
menu=NULL
--account--
roy=OFF
weps=OFF
ugad=OFF
modp=OFF
xmod=OFF
perm=OFF
graf=OFF
xp=OFF
lb=OFF
ce=OFF
cp=OFF
pxc=OFF
nnf=OFF
awe=OFF
rary=OFF
comm=OFF
unco=OFF
rare=OFF
epic=OFF
lege=OFF
myth=OFF
--rewards
colm=OFF
lotco=OFF
freel=OFF
chestc=OFF
task=OFF
pass=OFF
gemc=OFF
bmc=OFF
rewm=OFF
infs=OFF
clanche=OFF
super=OFF
eggrew=OFF
--non hooks--
inf=OFF
fir=OFF
rel=OFF
gcd=OFF
tem=OFF
swe=OFF
god=OFF
tgod=OFF
petr=OFF
asc=OFF
checkc=OFF
--hooks--
lazer=OFF
dasher=OFF2
chart=OFF
exdp=OFF
recn=OFF
igref=OFF
oog=OFF
melra=OFF
bozo=OFF
green=OFF
fanre=OFF
gost=OFF
killer=OFF
silam=OFF
scrin=OFF
coti=OFF
inbs=OFF
spedb=OFF
muchd=OFF
god1=OFF
ceend=OFF
xroy=OFF
focju=OFF
pooly=OFF
maghed=OFF
posef=OFF
blin=OFF
imef=OFF
tare=OFF
chams=OFF
wekn=OFF
elcs=OFF
slwd=OFF
coss=OFF
disj=OFF
disga=OFF
xrewm=OFF
premp=OFF
maxp=OFF
resp=OFF
eggcd=OFF
empo=OFF
gifter=OFF
unrel=OFF
cracked=OFF
evewe=OFF
uroy=OFF
uguns=OFF
juar=OFF
colot=OFF
unubg=OFF
clanw=OFF
unobg=OFF
claga=OFF
hroy=OFF
armop=OFF
zomb=OFF

------------------------------------------------------------------------------

--main--
function idk()
gg.toast("ASKA ON TOP!! duck you really thought we couldn't do shit?")

------------------------------------------------------------------------------

--offsets to call
I={}
I[1] = 0x491F3B4 -- clan parts 23.8.0 -- {1 below "internal int get_UpgradeTime() { }"} --done
I[2] = 0x491FEA0 -- clan parts second offset 23.8.0-- {1 below "public int get_NextUpPower() { }"} --done
I[3] = 0x491F0AC -- clan energy 23.8.0 -- {just search "internal int get_Energy() { }"} --done
I[4] = 0x17C9190 -- free lottery 23.8.0 -- {search "= "C"" and make sure its case matched, then the offsets the first int in that class} --done
I[5] = 0x2BD4F20 -- &lottocurrency 23.8.0 -- {search "internal GameEventItemType get_Type() { }" and its the int 3 below it(get_count)} --done
I[6] = 0x320F340 -- &Collectibles 23.8.0 -- {search "[Obsolete("legacy parameter")]" and the offsets 14 below(hint* its the bottom of a group of 2 int's and has a void int below)} --done
I[7] = 0x17C9190 -- &freechestcount 23.8.0 -- { search for the feild "public virtual List<GameEventItemContainer> " and the offset is the first int from the bottom of the class} --done
I[8] = 0x2240E5C -- gem clicker 23.8.0 -- {search for a method "List<AlmanachMigrationSettings> " and the bool is 6 below and has a void two above it} --done
I[9] = 0x3ED0EC8 -- &taskClicker 23.8.0 -- {search "CustomFirstAndConstNext = 2;" and its the class 5 below, and the offsets the 2nd bool from the bottom of the class} --done
I[10] = 0x215CBEC -- &pixelClicker 23.8.0 -- {search "PixelPassCurrencyPromotionUI" and the class is 3 above and the offset is 11 up from the bottom of that class(hint* its the 2nd bool from bottom)} --done
I[11] = 0x1E19050 -- &blackMarketClicker 23.8.0 -- {search "internal int CellId; //" and the class is 3 above with the offset 3 down(hint* its the first bool)} --done
I[12] = 0x3393944 -- &gadgetUnlocker 23.8.0 -- {search "internal static Dictionary<GadgetCategory," and its the one with a bool above it(you want the bool)} --done 
I[13] = 0x3216E34 -- &%fmodule 23.8.0 --{search for "internal List<ModulePointWithProbability> " that has a module chest feild with it and go 1 class up and the float offset is 8 below the class} --done
I[14] = 0x3954EBC -- &MaxModules 23.8.0 -- {[1] search "internal ModuleData.ModuleRarity Rarity; // " and the offsets 11 up from the bottom of the class above(hint* theres a list 2 below it)} --done
I[15] = 0x3955750 -- &MaxModules 23.8.0 -- {[2] its 3 below the previous offset(one below the list)} --done
I[16] = 0x3216C84 -- &MaxModules 23.8.0 -- {[3] search "private Lazy<ModuleData>", and the int is 6 below methods with a moduledata above it} --done
I[17] = 0x32173EC -- &NoPartsModules 23.8.0 -- {search "internal List<ModulePointWithProbability> " witha module chest above, then go 1 class up and the int is 23 below methods with a bool 2 below it} --done
I[18] = 0x282A3CC -- &noGadgetCooldown 23.8.0 -- {[1], search "private static Action<float, bool>" and its slot5} --done
I[19] = 0x282A448 -- &noGadgetCooldown 23.8.0 -- {[2], 2 below previous(slot 7)} --done 
I[20] = 0x20914B4 -- &xpl 23.8.0 {search -- "internal ExperienceController." and its the feilds one, and the int is 9 below methods(a void is below)} --done
I[21] = 0x49665D0 -- &lobbybundles 23.8.0 -- {1 class above "LobbyItemPlayerInfo" and the bool is 15 below methods and has a long above it} --done
I[22] = 0x3EEB14C -- &validatenickname2[both set to true] 23.8.0 -- {search "public bool ValidateNickName(string "} --done 
I[23] = 0x3EEB38C -- &validatenickname1 23.8.0 -- {one below this ^^^^} --done
I[24] = 0x5464D40 -- &fire rate 23.8.0 -- {search "internal static List<FilterMaps>" and its the one with an int below(not a float) and then the float is 6 below and is the second too first float] --done
I[25] = 0x26C5FF4 -- &infammo 23.8.0 -- {1 class above "SpeedModifier = 4;" and its the top the group of bools(float above)} --done
I[26] = 0x1915F9C -- &teamkill[1] [both set to false] 23.8.0 -- {its 4 below "	internal static SceneInfo "(the one without a long method string above it)} --done
I[27] = 0x1917360 -- &teamkill[2] 23.8.0 -- {9 below this ^^^^} --done
I[28] = 0x2321090 -- &swearfilter[set to false] 23.8.0 -- {vctor above "ChangeFillAmountOnDamage}" --done
I[29] = 0x551EED8 -- &god[1] 23.8.0 [all set to -> C0035FD6] -- {search "public void  onSyncGadgetReflectorCoeff() { }" then search "Vector3"(hint* its the longer method)} --done
I[30] = 0x2862DBC -- &god[2] 23.8.0 -- {4 classes above "private List<PlayerBotInstance>" and its the second float up from the bottom} --done
I[31] = 0x52AA7E0 -- &god[3] 23.8.0 -- {search "internal CapeAnimationController", then "private void OnTriggerEnter(Collider " --done
I[32] = 0x52A9F50 -- &god[4] 23.8.0 -- {first search the same as above ^^^, then "OnControllerColliderHit(ControllerColliderHit"} --done
I[33] = 0x2602920 -- &turrentgod[1] 23.8.0 [all set to C0035FD6] -- {all the minuslive} --done
I[34] = 0x2607A78 -- &turrentgod[2] 23.8.0 --done
I[35] = 0x59816AC -- &turrentgod[3] 23.8.0 --done
I[36] = 0x48CE438 -- &petrespawn 23.8.0 -- {search "internal float get_RespawnTime() { }"} --done
I[37] = 0x3A0A900 -- &arenascore 23.8.0 -- {3 below this^^} --done 
I[38] = 0x597E240 -- &GetFreeCheckpointsCount 23.8.0 -- {GetFreeCheckpointsCount} --done
I[39] = 0x17CB81C -- &rarity 23.8.0 -- {the offsets 1 below "internal virtual ItemRarity get_Rarity() { }"} --done 
I[40] = 0x3D36598 -- useless --not needed
I[41] = 0x3D364F8 -- useless --not needed
I[42] = 0x419B848 -- Rewards Multiplier In a Game (99x MAX) -- search for the class "DoubleRewardConnectScene" then go one class up, then the int is 1 above the first "Nullable<DateTime> " --done
I[43] = 0x255F250 -- Unlimited Super Clan Chest, -- search "Range = 3;" and then go 3 classes up and the int is 9 from the top with a static above and below --done
I[44] = 0x255F998 -- Clan Chest Open Price[1] -- 8 below previous offset(to extention) --done 
I[45] = 0x2560730 -- Clan Chest Open Price[2] -- int is 3 above prevoius with static above --done
I[46] = 0x2560730 -- Super Clan Chest Points Modifier -- go to the extension below clan chest price[1] --done
I[47] = 0x41A2218 -- Egg Reward Modificator[1] -- search class EggsMigrationView and then go one class up, then go to the top and search "internal List<EggIncubatorProgress> " and the int is one below --done
I[48] = 0x41A2218 -- Egg Reward Modificator[2] its 9 up from the previous offsets class with an item rarity above it --done
I[49] = 0x32F5130 -- [1]Give all wears/armors/graffiti require parts -- search “ItemEquipParams” and its the one with - offset and the go one class up and the bool is 4 from the bottom with a string 2 below it --done
I[50] = 0x32F4EF8 -- [2]10 above this^^, make sure the argument has an int in it, ex: internal int 一丕丄且世丏丄不下 (int 万丆万上丌上丒专上) { } --done
I[51] = 0x5987C7C -- campaign -- Search “private Dictionary<int, ChooseBoxItemOnClick>” and the bool is 7 down with a string above it --done
I[52] = 0x547EB1C -- guns/shovel 2 --done
I[53] = 0x3219554 -- guns/shovel 2 --done
I[54] = 0x547EB1C -- royal -- search "[IteratorStateMachine(typeof(BalanceController." with a void above(not bool) then go up until you find a on destroy, and the bool is 13 above it with a static above and a void below --done
I[55] = 0x43AB748 -- royal -- search for the feild "internal static Dictionary<CategoryNames, string>" then the bool is 30 down, make sure its the bottom 丅且丞丕丑丗丙世丞(CategoryNames 丛七丑丘丑丐一丗七, ItemRecord 业业丕丂丒万专且三, bool 丙东不丞丏丕丛丏七 = True) { } --done 
I[56] = 0x43B20C0 -- wep skins -- search "public string weaponViewedId;" and go 1 class down and the bool is 23 up from the bottom with a list item record above --done
I[57] = 0x4549EC0 -- wep skins -- search for "internal static Dictionary<string, Dictionary<string, int>> " where theres only one of that method in that class and the int is two above it --done
I[58] = 0x439FA64 -- just armor -- Search “	internal static readonly Dictionary<CategoryNames, string” and its the one where it has the same field above it, then search “(GameplayLoopType” and the bool is 8 above with a int being 4 above it --done
I[59] = 0x20913F4 -- set custom level --23.8.0 -- search "internal ExperienceController" feild and the int is 7 below methods witha a void above --done
I[60] = 0x52AE22C -- Show all Deleted/Exclusive Gadgets[1] 23.8.0 edit both to true -- go one class up from " string leftWearItem, string rightWearItem) { }" and the bool is 5 from the bottom --done
I[61] = 0x384E100 -- Show all Deleted/Exclusive Gadgets[2] -- search , PropertiesArmoryItemContainer" and make sure its the 9th one and has a false string in the argument, and the bool is 2 above --done
I[62] = 0x2E8C8D8 -- emperor 23.8.0 -- go one class up from "rewardCurrencySingleCountLabel" and the int is one down from methods --done
I[63] = 0x419B784 -- inf 2x rew -- search "class DoubleRewardConnectScene" and go one class up and the bool is 9 from the bottom with a date time above --done
I[64] = 0x2150EA0 -- max pass[temp] -- go to the 6th Namespace: PGCompany.PixelPass [new line] internal sealed class, then search Nullable<long> method and the int is 9 below it --done
I[65] = 0x2157938 -- premium pass -- one above this ^^ --done
I[66] = 0x2153C28 -- reset pass -- its the 2nd date time in the same class as this^^ --done
I[67] = 0x41A5E98 -- pet egg cd -- search public class Nest : MonoBehaviour and thr long is 14 down --done
I[68] = 0x5B6E838 -- mobs per wave -- first int down from public sealed class ZombieCreator --done
I[69] = 0x3393944 -- clan gadgets -- one above "	internal static Dictionary<GadgetCategory, List<string>> " --done
I[70] = 0x229520C -- set clicker --done
I[71] = 0x52ADABC -- unlock unreleased royal and hats -- search "public int currentLevel; //" with multiple feilds and the bool is 6 below methods with an itemrecord x 2 above --done
I[72] = 0x4549EC0 -- wear parts [401F80D2C0035FD6 ]-- search " { get; } [new line] internal static Dictionary<string, Dictionary<string," with a list string above it and go 10 down from methods --done
I[73] = 0x3201B88 -- wear [true] -- go to "(IReadOnlyList" with an int below(also 5th search) and the bool is 6 above --done
I[76] = 0x215D3DC -- gift pass offers 1 -- search "PixelPassLoadingTipsController" and go 3 classes down and the bools 16 down with a string above --done
I[77] = 0x215D450 -- gift pass offers 2 -- 1 below this ^^ --done
I[78] = 0x215D77C -- gift pass offers 3 -- 9 below this^^ --done
I[79] = 0x5617EC0 -- clan wear -- [false] use "BadNetworkBlinkingController" to find class. it is a small class but below is the class for clan Armors. 3rd offset from bottom up, bool --done, 
I[80] = 0x24EC370 -- collectibles v2 [true] combined with vd3 -- search "internal DateTime StartBuyProxyDate" and go 3 classes down and the bool is 20 up with an int below it
I[81] = 0x439FA64 -- unreleased royal [false] --done 
I[82] = 0x52AE91C --  unreleased royal [true] --done
I[83] = 0x17C9190 -- armory price[not weps] --done

------------------------------------------------------------------------------

function HOME()

if imdev==true then
  DEVT=gg.choice({
             '💾 • Account',
             '🏦 • Rewards',
             '🕹️ • Gameplay', 
             '🌐 • Misc',
             '🗓️ • info',
             '🔨• Dev tools',
             '🚫 • Exit'},nil,"hello "..dev.." ◉_◉\nASKA RUNS U")
elseif imdev == false then
  DEVT=gg.choice({
             '💾 • Account',
             '🏦 • Rewards',
             '🕹️ • Gameplay',
             '🌐 • Misc',
             '🗓️ • info',
             '🚫 • Exit'}
    ,nil,"PG3D menu by "..dev.." ["..version.."]")
end

multi = DEVT
--account--
function ch1()           
account=gg.choice({
        menu.. "🔝 • Levels menu",
        menu.. "🔫 • Armory",
          lb.. "🗃 • Lobby bundles",
          ce.. "🛡 • Clan energy",
          cp.. "🛡 • 0 Parts clan upgrade",
         nnf.. "🤬 • No nickname filter",
         empo.."👑 • Instant emperor",
               "⬅️️ • Back"}
          ,nil,"💾 • Account")
  
  --emporor
  if account == 7 then
  if empo == OFF then
  Patch('libil2cpp.so',I[62],'E01B1632C0035FD6')
  empo=ON
  else
  Restore('libil2cpp.so',I[62])
  empo=OFF
  end
  end
  
--account exits                                
if account == 8 then 
    HOME()
end
if account == nil then 
    HOME()
end

--nickname filter--
if account == 6 then 
 if nnf==OFF then
    Patch("libil2cpp.so",I[22],"20008052C0035FD6")
    Patch("libil2cpp.so",I[23],"20008052C0035FD6")          
    nnf=ON
    else Restore("libil2cpp.so",I[23])
         Restore("libil2cpp.so",I[22])
        gg.toast("Reverted")
       nnf=OFF
    end
  end

--level spoofer--
if account == 1 then
cuslev=gg.choice({'lvl65 (part 1)','level65 (part 2)','↓custom↓','max+ int','lvl 69','back'},nil,'Level menu')
if cuslev==1 then
Patch("libil2cpp.so",I[63],"20008052C0035FD6")
end
if cuslev==2 then
Patch('libil2cpp.so',I[42],'00328052C0035FD6')
end
if cuslev==3 then
    Patch("libil2cpp.so",I[59],"A0F08F52C0035FD6")
end
if cuslev==4 then
Patch("libil2cpp.so",I[59],"A0088052C0035FD6")
--A0088052C0035FD6
end
if cuslev==5 then
ch1()
end
if cuslev==nil then
ch1()
end
ch1()
    end

--armory--
if account == 2 then
  function armory()
    armor = gg.choice({
  armop..'$ • Armory Price Modifer[not weapons]',
 uguns.. '🔫 • Unlock Guns & Shovels',
  juar.. '🎉 • Unlock all Holiday Event Armors',
  clanw..'🛡️ • Unlock All Clan Armors',
  uroy.. '🏆 • Unlock royal skins',
  hroy..'❓ • Unlock all Hidden Royale/Avatars',
  weps.. '🏹 • Unlock weapon skins[test]',
  ugad.. '💣 • Unlock gadgets',
  unobg..'❓ • Show all Deleted/Exclusive Gadgets',
  claga..'🛡️ • Unlock all clan gadgets',
  modp.. '💿 • 0 Parts modules',
  xmod.. '📀 • X modules',
  perm.. '💯 • Modules 100%',
  rary.. '🔁 • Rarity changer',
  graf.. '🎉 • Free Craft all Wears/Armors/Graffitis',
  unrel..'🚙 • Unlock Show All Unrealeased Royale Hats/Vehicles',
         '⬅️️ • Back'   
   },nil,'🔫 • Armory')

 --armory price--
 if armor == 1 then
  if armop==OFF then 
    Patch("libil2cpp.so",I[83],"20008052C0035FD6")  
    armop=ON
            else
        Restore("libil2cpp.so",I[83])
        armop=OFF
        gg.toast("Reverted")
    end
    armory()  
   end
   
--unlock guns--
if armor == 2 then
if uguns == OFF then
Patch("libil2cpp.so",I[52],"00008052C0035FD6")
Patch("libil2cpp.so",I[53],"00008052C0035FD6")
uguns=ON
            else
    Restore("libil2cpp.so",I[52])
    Restore("libil2cpp.so",I[53])
    uguns=OFF
  end
armory()  
end

--event wear--
if armor == 3 then
            if juar==OFF then
    Patch("libil2cpp.so",I[72],"401F80D2C0035FD6")
    Patch("libil2cpp.so",I[73],"00008052C0035FD6")
    juar=ON
            else
              Restore("libil2cpp.so",I[72])
              Restore("libil2cpp.so",I[73])
              juar=OFF
            end
    armory()  
end

--clan wear
if armor == 4 then
if clanw==OFF then
Patch("libil2cpp.so",I[79],"00008052C0035FD6")
clanw=ON
else
Restore("libil2cpp.so",I[79])
clanw=OFF
end
armory()  
end

-- unlock royal skins--
if armor == 5 then
            if uroy==OFF then
  Patch("libil2cpp.so",I[54],"E0031F2AC0035FD6")        
  Patch("libil2cpp.so",I[55],"20008052C0035FD6")
  Patch("libil2cpp.so",I[71],"20008052C0035FD6")
  uroy = ON
            else
              Restore("libil2cpp.so",I[54])
              Restore("libil2cpp.so",I[55])
              Restore("libil2cpp.so",I[71])
              uroy=OFF
            end
  armory()  
end
--81 82

--hidden royal--
if armor == 6 then
 if hroy==OFF then 
    Patch("libil2cpp.so",I[81],"00008052C0035FD6")  
    Patch("libil2cpp.so",I[82],"20008052C0035FD6")   
    hroy=ON
            else
        Restore("libil2cpp.so",I[81])
        Restore("libil2cpp.so",I[82])
        hroy=OFF
        gg.toast("Reverted")
    end
    armory()
end

--unlock weapon skins--
if armor == 7 then
 if weps==OFF then
  Patch("libil2cpp.so",I[56],"20008052C0035FD6")
  Patch("libil2cpp.so",I[57],"00008052C0035FD6") 
  weps=ON
   else
  Restore("libil2cpp.so",I[56])
  Restore("libil2cpp.so",I[57])
  gg.toast("Reverted")           
  weps=OFF            
 end
 armory()  
end

--unlock gadgets--
if armor == 8 then 
 if ugad==OFF then 
    Patch("libil2cpp.so",I[12],"20008052C0035FD6")  
    ugad=ON
            else
        Restore("libil2cpp.so",I[12])
        ugad=OFF
        gg.toast("Reverted")
    end
    armory()  
  end  
  
--deleted gad--
if armor == 9 then
if unobg==OFF then
    Patch("libil2cpp.so",I[60],"20008052C0035FD6") 
    Patch("libil2cpp.so",I[61],"20008052C0035FD6")
    unobg=ON
    else
        Restore("libil2cpp.so",I[60])
        Restore("libil2cpp.so",I[61])
        unobg=OFF
        end
        armory()  
end

--clan gad--
if armor == 10 then
if claga==OFF then
    Patch("libil2cpp.so",I[69],"20008052C0035FD6")
    claga=ON
    else
       Restore("libil2cpp.so",I[69])
       claga=OFF
    end
    armory()  
end

--0 parts modules--
if armor == 11 then
if modp==OFF then 
   Patch("libil2cpp.so",I[17],"00008052C0035FD6")      
   modp=ON
            else
        Restore("libil2cpp.so",I[17])
        modp=OFF
        gg.toast("Reverted")
    end
    armory()  
end

--x modules--
if armor == 12 then
if xmod==OFF then 
   Patch("libil2cpp.so",I[14],"C0035FD6F55301A9")
   Patch("libil2cpp.so",I[15],"20008052C0035FD6")
   Patch("libil2cpp.so",I[16],"40018052C0035FD6")             
   xmod=ON
            else
        Restore("libil2cpp.so",I[14])
        Restore("libil2cpp.so",I[15])
        Restore("libil2cpp.so",I[16])        
        xmod=OFF
        gg.toast("Reverted")
    end
    armory()  
end
  
  --modules %--
if armor == 13 then
 if perm==OFF then 
    Patch("libil2cpp.so",I[13],"00008052C0035FD6")
    perm=ON
            else 
    Restore("libil2cpp",I[13])
    perm=OFF
    gg.toast("Reverted")
    end
    armory()  
  end
  
--graffiti/wear--
 if armor == 15 then
 if graf==OFF then 
    Patch("libil2cpp.so",I[49],"20008052C0035FD6")  
    Patch("libil2cpp.so",I[50],"E07C8052C0035FD6")   
    graf=ON
            else
        Restore("libil2cpp.so",I[49])
        Restore("libil2cpp.so",I[50])
        graf=OFF
        gg.toast("Reverted")
    end
    armory()  
 end

--unreleased vehicles
if armor==16 then
if unrel==OFF then 
  Patch("libil2cpp.so",I[71],"20008052C0035FD6")
  unrel=ON
      else
    Restore("libil2cpp.so",I[71])
    unrel=OFF
end
armory()
end

--rarity
if armor == 14 then
rarity = gg.choice({
      "⚪ • Common",
      "🟢 • Uncommon",
      "🔵 • Rare",
      "🟡 • Epic",
      "🔴 • Legendary",
      "🟣 • Mythical",
            "⬅️️ • Back"}
       ,nil,'🔁 • Rarity changer')

--common--
if rarity == 1 then
  if rary==OFF then
     Patch("libil2cpp.so",I[39],"00008052C0035FD6")
     rary=ON
              else
        Restore("libil2cpp.so",I[39])
        rary=OFF
        gg.toast("Reverted")
    end
end

--uncommon--
if rarity == 2 then 
  if rary==OFF then 
     Patch("libil2cpp.so",I[39],"20008052C0035FD6")  
     rary=ON
              else
        Restore("libil2cpp.so",I[39]) 
                rary=OFF
        gg.toast("Reverted")
    end
end

--rare--
if rarity == 3 then
  if rary==OFF then 
     Patch("libil2cpp.so",I[39],"40008052C0035FD") 
     rary=ON
              else
        Restore("libil2cpp.so",I[39])
                rary=OFF
        gg.toast("Reverted")
    end
end

--epic--
if rarity == 4 then 
  if rary==OFF then 
      Patch("libil2cpp.so",I[39],"60008052C0035FD6")
      rary=ON
              else
        Restore("libil2cpp.so",I[39])
                rary=OFF
        gg.toast("Reverted")
    end
end

--legendary--
if rarity == 5 then
  if rary==OFF then 
     Patch("libil2cpp.so",I[39],"80008052C0035FD6") 
     rary=ON
              else
        Restore("libil2cpp.so",I[39])
                rary=OFF
        gg.toast("Reverted")
    end
end

--mythical--
if rarity == 6 then
  if rary==OFF then 
      Patch("libil2cpp.so",I[39],"A0008052C0035FD6") 
      rary=ON
              else
        Restore("libil2cpp.so",I[39])
                rary=OFF
        gg.toast("Reverted")
    end
end

--rarity exits
if rarity == 7 then
armory()
end

if rarity == nil then
armory()
end
armory()  
end

--armory exits--
if armor == 17 then 
    ch1()
end

if armor == nil then
    ch1()
end
end
armory()
end

--lobby bundles--
if account == 3 then
 if lb==OFF then 
     Patch("libil2cpp.so",I[21],"20008052C0035FD6")
     lb=ON
        else
        Restore("libil2cpp.so",I[21]) 
        lb=OFF
        gg.toast("Reverted")
    end
    ch1()
end

--clan energy-- 
if account == 4 then 
 if ce==OFF then 
     Patch("libil2cpp.so",I[3],"00008052C0035FD6") 
     ce=ON
        else
        Restore("libil2cpp.so",I[3]) 
          ce=OFF
        gg.toast("Reverted")
    end
    ch1()
end

--clan parts--
if account == 5 then
 if cp==OFF then 
     Patch("libil2cpp.so",I[1],"00008052C0035FD6")
     Patch("libil2cpp.so",I[2],"00008052C0035FD6")      
     cp=ON
        else
        Restore("libil2cpp.so",I[1])  
        Restore("libil2cpp.so",I[2]) 
          cp=OFF
        gg.toast("Reverted")
    end
end
ch1() 
end

------------------------------------------------------------------------------

--rewards--
function ch2()
local rewards=gg.choice({
                colm.."🚨 • Collectible menu[somewhat patched]",
                colot.."🎁 • Lottery collectibles modifier",
             cracked.."💸 • cracked collectbles[loading screen]",
               freel.."🆓 • Free lottery",
                menu.."☝️ • Clickers",
              chestc.."🔓 • 2b free chests[patched]",
             clanche.."🔐 • Free clan chest",
               super.."💎 • Super chest collection points",
                infs.."🔑 • Unlimited clan super chests",
              eggrew.."🙀 • Egg reward mod",
               premp.."🛒 • premium pass[temp]",
                maxp.."💯 • max pass[temp]",
                resp.."🔁 • reset pass[loading screen]",
               eggcd.."🥚 • no egg hatch cooldown[loading screen]",
              gifter.."📞 • gift all pass offers",
                      "⬅️️ • Back"}
                 ,nil,"🏦 • Rewards")

--cracked collectibles=
if rewards == 3 then
if cracked == OFF then
if crack~=true then
gg.choice({"⚠️ WARNING ⚠️", 
"There is a few steps required to do before running this.",
"Step 1:",
"You must buy or obtain a chest but dont open it. You can use Clan Super Chest, just click buy or click the chest but dont click 'Open Chest'",
"Step 2: Relog",
"Step 3: run this again before 75% in loading scene",
"Step 4: Open chests",
"(The first time it may freeze for like 20 seconds but then unfreeze and will work and run a loop.)",
"Step 5: Enjoy! ❤️🙏🏽",})
end
loopco=gg.choice({"500","1000","2500","5000[max or ban]","back"})
  if loopco==1 then
        elseif loopco==2 then
            Patch("libil2cpp.so",I[6],"803E8052C0035FD6") 
            Patch('libil2cpp.so',I[80],'20008052C0035FD6')
            crack=true
            cracked=ON
        elseif loopco==2 then
            Patch("libil2cpp.so",I[6],"007D8052C0035FD6") 
            Patch('libil2cpp.so',I[80],'20008052C0035FD6')
            crack=true
            cracked=ON
        elseif loopco==3 then
            Patch("libil2cpp.so",I[6],"80388152C0035FD6") 
            Patch('libil2cpp.so',I[80],'20008052C0035FD6')
            crack=true
            cracked=ON
        elseif loopco==4 then
            Patch("libil2cpp.so",I[6],"00718252C0035FD6") 
            Patch('libil2cpp.so',I[80],'20008052C0035FD6')
            crack=true
            cracked=ON
        elseif loopco==5 or loopco==nil then
     ch2()
  end
else
Restore("libil2cpp.so",I[6])
Restore('libil2cpp.so',I[80])
cracked=OFF
end
ch2()
end

--premium pass--
if rewards == 11 then
if premp==OFF then
Patch('libil2cpp.so',I[65],'20008052C0035FD6')
premp=ON
else
Restore('libil2cpp.so',I[65])
premp=OFF
end
ch1()
end

--max pass--
if rewards == 12 then
if maxp==OFF then
Patch('libil2cpp.so',I[64],'00A68E52C0035FD6')
maxp=ON
else
Restore('libil2cpp.so',I[64])
maxp=OFF
end
ch2()
end

--reset pass--
if rewards == 13 then
if resp==OFF then
Patch('libil2cpp.so',I[66],'20008052C0035FD6')
resp=ON
else
Restore('libil2cpp.so',I[66])
resp=OFF
end
--20 00 80 52 C0 03 5F D6
ch2()
end

--eggcd--
if rewards == 14 then
if eggcd==OFF then
Patch('libil2cpp.so',I[67],'20008052C0035FD6')
eggcd=ON
else
Restore('libil2cpp.so',I[68])
eggcd=OFF
end
ch2()
end

----collectibles
if rewards == 1 then
  if ping==true then
 gg.alert('Use lottery collectibles if you want to use it for currencies(this only works for collecting chests)')
 gg.alert("DO NOT USE THIS ON CHEST CURRENCIES!!!!!")
          end
  if colm==OFF then
  cool = gg.choice({
      '💾️ • 0',
      '💾️ • 250',
      '💾️ •️ 500',
      '💾️ • 1000',
      '💾️ • 2500',
      '💾 • 10000',
      '💾️ • 50000',
      '💾️ • 1M',
      '💾️ • 2B',
      '⬅️️ • Back'
}
,nil,'🚨 • Collectible Menu' )


--collectible exits--
if cool == 10 then
ch2()
end
 
if cool == nil then
ch2()
end

if cool == 1 then
if colm==OFF then 
     Patch("libil2cpp.so",I[6],"000080D2C0035FD6") 
     colm=ON
          else
        Restore("libil2cpp.so",I[6]) 
        colm=OFF
        gg.toast("Reverted")
    end
    ch2()
end
if cool == 2 then
if colm==OFF then 
    Patch("libil2cpp.so",I[6],"401F80D2C0035FD6")
    colm=ON
          else
        Restore("libil2cpp.so",I[6]) 
        colm=OFF
        gg.toast("Reverted")
    end
    ch2()
end
if cool == 3 then 
if colm==OFF then 
   Patch("libil2cpp.so",I[6],"803E80D2C0035FD6") 
   colm=ON
          else
        Restore("libil2cpp.so",I[6]) 
        colm=OFF
        gg.toast("Reverted")
    end
    ch2()
end
if cool == 4 then
if colm==OFF then 
   Patch("libil2cpp.so",I[6],"007D80D2C0035FD6") 
   colm=ON
          else
        Restore("libil2cpp.so",I[6]) 
        colm=OFF
        gg.toast("Reverted")
    end  
    ch2()
end
if cool == 5 then
if colm==OFF then 
   Patch("libil2cpp.so",I[6],"803881D2C0035FD6") 
   colm=ON
          else
        Restore("libil2cpp.so",I[6]) 
        colm=OFF
        gg.toast("Reverted")
    end  
    ch2()
end
if cool == 6 then 
if colm==OFF then 
   Patch("libil2cpp.so",I[6],"00E284D2C0035FD6") 
   colm=ON
          else
        Restore("libil2cpp.so",I[6]) 
        colm=OFF
        gg.toast("Reverted")
    end  
    ch2()
end
if cool == 7 then
if colm==OFF then 
   Patch("libil2cpp.so",I[6],"006A98D2C0035FD6") 
   colm=ON
          else
        Restore("libil2cpp.so",I[6]) 
        colm=OFF
        gg.toast("Reverted")
    end  
    ch2()
end
if cool == 8 then 
if colm==OFF then 
   Patch("libil2cpp.so",I[6],"0002A0D2C0035FD6")
   colm=ON
          else
        Restore("libil2cpp.so",I[6]) 
        colm=OFF
        gg.toast("Reverted")
    end    
    ch2()
end
if cool == 9 then
if colm==OFF then 
   Patch("libil2cpp.so",I[6],"E07B40B2C0035FD6") 
   colm=ON
          else
        Restore("libil2cpp.so",I[6])  
        colm=OFF
        gg.toast("Reverted")
    end    
end
  ping=false
          else
            Restore("libil2cpp.so",I[6])
            colm=OFF
            ch2()
          end
ch2()
end

--lottery collectibles--
if rewards == 2 then
if colot == OFF then
        Restore("libil2cpp.so",I[5]) 
        colot=OFF
        gg.toast("Reverted")
        ch2()
          else
cool = gg.choice({
      '💾️ • 0',
      '💾️ • 250',
      '💾️ •️ 500',
      '💾️ • 1000',
      '💾️ • 2500',
      '💾 • 10000',
      '💾️ • 50000',
      '💾️ • 1M',
      '💾️ • 2B',
      '⬅️️ • Back'}
 ,nil,'🎁 • Lottery collectibles modifier' )

--collectible exits--
if cool == 10 then
ch2()
end
 
if cool == nil then
ch2()
end

if cool == 1 then
if colot==OFF then 
   Patch("libil2cpp.so",I[5],"000080D2C0035FD6") 
   colot=ON
          else
        Restore("libil2cpp.so",I[5]) 
        colot=OFF
        gg.toast("Reverted")
    end
    ch2()
end
if cool == 2 then
if colot==OFF then 
   Patch("libil2cpp.so",I[5],"401F80D2C0035FD6") 
   colot=ON
          else
        Restore("libil2cpp.so",I[5]) 
        colot=OFF
        gg.toast("Reverted")
    end
    ch2()
end
if cool == 3 then 
if colot==OFF then 
   Patch("libil2cpp.so",I[5],"803E80D2C0035FD6") 
   colot=ON
          else
        Restore("libil2cpp.so",I[5]) 
        colot=OFF
        gg.toast("Reverted")
    end
    ch2()
end
if cool == 4 then
if colot==OFF then 
   Patch("libil2cpp.so",I[5],"007D80D2C0035FD6")
   colot=ON
          else
        Restore("libil2cpp.so",I[5])
        colot=OFF
        gg.toast("Reverted")
    end  
    ch2()
end
if cool == 5 then
if colot==OFF then 
   Patch("libil2cpp.so",I[5],"803881D2C0035FD6")
   colot=ON
          else
        Restore("libil2cpp.so",I[5]) 
        colot=OFF
        gg.toast("Reverted")
    end  
    ch2()
end
if cool == 6 then 
if colot==OFF then 
   Patch("libil2cpp.so",I[5],"00E284D2C0035FD6")
   colot=ON
          else
        Restore("libil2cpp.so",I[5])
        colot=OFF
        gg.toast("Reverted")
    end  
    ch2()
end
if cool == 7 then
if colot==OFF then 
   Patch("libil2cpp.so",I[5],"006A98D2C0035FD6")
   colot=ON
          else
        Restore("libil2cpp.so",I[5]) 
        colot=OFF
        gg.toast("Reverted")
    end  
    ch2()
end
if cool == 8 then 
if colot==OFF then 
   Patch("libil2cpp.so",I[5],"0002A0D2C0035FD6")
   colot=ON
          else
        Restore("libil2cpp.so",I[5]) 
        colot=OFF
        gg.toast("Reverted")
    end    
    ch2()
end
if cool == 9 then
if colot==OFF then 
   Patch("libil2cpp.so",I[5],"E07B40B2C0035FD6")
   colot=ON
          else
        Restore("libil2cpp.so",I[5]) 
        colot=OFF
        gg.toast("Reverted")
    end    
end
        end
ch2()
end

--free lottery--
if rewards == 4 then
  if freel==OFF then 
     Patch("libil2cpp.so",I[4],"E0E18412C0035FD6")
     freel=ON
          else
        Restore("libil2cpp.so",I[4]) 
        freel=OFF
        gg.toast("Reverted")
      end    
      ch2()
end

--clickers--
if rewards == 5 then
function ch4()
  local clickers = gg.choice({
                    "⬅️️ • Back",
             task.. "💰 • Task clicker",
             pass.. "🏆 • Pass reward clicker",
             gemc.. "🏷 • Gem clicker[gallery]",
              bmc.. "🔰 • Black market clicker"}
               ,nil,"☝️ • clickers")
        
--exits--
if clickers == nil then
ch2()
    end 
if clickers == 1 then
ch2()
      end

--task clicker--
if clickers == 2 then
  if task==OFF then
     Patch("libil2cpp.so",I[9],"20008052C0035FD6")
     task=ON
            else
        Restore("libil2cpp.so",I[9])  
        task=OFF
        gg.toast("Reverted")
      end    
      ch4()
   end

--pass reward clicker--
if clickers == 3 then
 if pass==OFF then 
    Patch("libil2cpp.so",I[10],"00008052C0035FD6")
    pass=ON
            else
        Restore("libil2cpp.so",I[10])
        pass=OFF
        gg.toast("Reverted")
      end    
      ch4()
     end
     
--gallery clicker--
if clickers == 4 then
  if gemc==OFF then
     Patch("libil2cpp.so",I[8],"200080D2C0035FD6")
     gemc=ON
            else
        Restore("libil2cpp.so",I[8])  
        gemc=OFF
        gg.toast("Reverted")
      end    
      ch4()
    end
   
--black market clicker--
if clickers == 5 then
  if bmc==OFF then 
     Patch("libil2cpp.so",I[11],"00008052C0035FD6")
     bmc=ON
            else
        Restore("libil2cpp.so",I[11]) 
        bmc=OFF
        gg.toast("Reverted")
      end    
    end            
    ch4()
end
ch4()
end

--chestcount--
if rewards == 6 then
 if chestc==OFF then 
   Patch("libil2cpp.so",I[7],"E07B40B2C0035FD6")
   chestc=ON
          else
        Restore("libil2cpp.so",I[7])
        chestc=OFF
        gg.toast("Reverted")
    end    
    ch2()
end

--free clan chest
if rewards == 7 then
 if clanche==OFF then 
   Patch("libil2cpp.so",I[44],"00008052C0035FD6")
   Patch("libil2cpp.so",I[45],"00008052C0035FD6")
   clanche=ON
          else
        Restore("libil2cpp.so",I[44])
        Restore("libil2cpp.so",I[45])
        clanche=OFF
        gg.toast("Reverted")
    end    
    ch2()
end

--super points--
if rewards == 8 then
 if super==OFF then
   Patch("libil2cpp.so",I[46],"80388152C0035FD6")
   super=ON
          else
        Restore("libil2cpp.so",I[46]) 
        super=OFF
        gg.toast("Reverted")
    end    
    ch2()
end

--inf super--
if rewards == 9 then
 if infs==OFF then
   Patch("libil2cpp.so",I[43],"00008052C0035FD6")
   infs=ON
          else
        Restore("libil2cpp.so",I[43]) 
        infs=OFF
        gg.toast("Reverted")
    end    
    ch2()
end

--pet reward--
if rewards == 10 then
 if eggrew==OFF then
   Patch("libil2cpp.so",I[48],"E07C8052C0035FD6")
   eggrew=ON
          else
        Restore("libil2cpp.so",I[48]) 
        eggrew=OFF
        gg.toast("Reverted")
    end    
    ch2()
end

--pass offsers
if rewards == 15 then
if gifter==OFF then
Patch("libil2cpp.so",I[76],"200080D2C0035FD6")
Patch("libil2cpp.so",I[77],"200080D2C0035FD6")
Patch("libil2cpp.so",I[78],"200080D2C0035FD6")
gifter=ON
else
Restore("libil2cpp.so",I[76])
Restore("libil2cpp.so",I[77])
Restore("libil2cpp.so",I[78])
gifter=OFF
end
ch2()
end
--rewards exits--
if rewards == 16 then 
  HOME()
end

if rewards == nil then 
  HOME()
end 
end

------------------------------------------------------------------------------

--gameplay--
function ch3()

--feild offset modification functions--
  function O_dinitial_search(class)
		gg.setRanges(gg.REGION_OTHER);
		gg.searchNumber(":" .. class, gg.TYPE_BYTE);
		count = gg.getResultsCount();
		if (count == 0) then
		else
			Refiner = gg.getResults(1);
			gg.refineNumber(Refiner[1].value, gg.TYPE_BYTE);
			count = gg.getResultsCount();
			val = gg.getResults(count);
			gg.addListItems(val);
		end
	end
	function CA_pointer_search()
		gg.clearResults();
		gg.setRanges(gg.REGION_C_ALLOC);
		gg.loadResults(gg.getListItems());
		gg.searchPointer(0);
		count = gg.getResultsCount();
		vel = gg.getResults(count);
		gg.clearList();
		gg.addListItems(vel);
	end
	function CA_apply_offset()
    tanker = 0xfffffffffffffff0
    local copy = false
    local l = gg.getListItems()
    if not copy then gg.removeListItems(l) end
    for i, v in ipairs(l) do
      v.address = v.address + tanker
      if copy then v.name = v.name..' #2' end
    end
    gg.addListItems(l)
	end
	function A_base_value()
		gg.setRanges(gg.REGION_ANONYMOUS);
		gg.loadResults(gg.getListItems());
		gg.clearList();
		gg.searchPointer(0);
		count = gg.getResultsCount();
		tel = gg.getResults(count);
		gg.addListItems(tel);
	end
	function A_base_accuracy()
	  gg.setRanges(gg.REGION_ANONYMOUS | gg.REGION_C_ALLOC)
		gg.loadResults(gg.getListItems());
		gg.clearList();
		gg.searchPointer(0);
		count = gg.getResultsCount();
		kol = gg.getResults(count);
		i = 1;
		h = {};
		while (i - 1) < count do
			h[i] = {};
			h[i].address = kol[i].value;
			h[i].flags = 32;
			i = i + 1;
		end
		gg.addListItems(h);
	end
	function A_user_given_offset(_offset, type)
		local _offset = load("return " .. _offset)();
		local old_save_list = gg.getListItems();
		for i, v in ipairs(old_save_list) do
			v.address = v.address + _offset;
			v.flags = type;
		end
		gg.clearResults();
		gg.loadResults(old_save_list);
	end
	function findClassPointer(class)
		gg.clearResults();
		gg.clearList();
		O_dinitial_search(class);
		CA_pointer_search();
		CA_apply_offset();
		A_base_value();
		A_base_accuracy();
	end
	function hackOffset(_offset, type, value)
		A_user_given_offset(_offset, type);
		gg.refineNumber("0~40", type);
		gg.getResults(99999999);
		gg.editAll(value, type);
	end

------------------------------------------------------------------------------

--main gameplay--      
function yes()
local gameplay=gg.choice({
               "🎣 • Hooks",
               "📢 • Non hooks",
               "🕹️ • Gamemodes",
               "⬅️️ • Back"}
         	,nil,"🕹️ • Gameplay")
	
--gameplay exits--
 if (gameplay == 4) then
	   game = 1
	  HOME()
	end

 if (gameplay == nil) then 
  gg.setVisible(false)
   while true do 
    if gg.isVisible(true) then
      gg.setVisible(false)
      yes()
   end
  end
 end

------------------------------------------------------------------------------

--hooks--
 if (gameplay == 1) then
					findClassPointer("WeaponSounds");
					function Hooky()
						hooks = gg.choice({
						  "🔫 • weapon mods",
						  "🛡️ • Utilities",
						  "🔮 • Effects",
						  "⬅️️ • Back"}
			 	,nil, "🎣 • Hooks");
						function buycan()
							for i, v in ipairs(canbuy) do
								hackOffset(v[1], v[2], v[3]);
							end
						end
						function scope()
							for i, v in ipairs(scopefast) do
								hackOffset(v[1], v[2], v[3]);
							end
						end
                        local bigFloat = "1000000.0";
						local class = "WeaponSounds"
                        local scopefast = {{"0xE8",gg.TYPE_BYTE,100}};
                        local isharpoon = {{"0x2B8",gg.TYPE_BYTE,1},{"0x2C8",gg.TYPE_FLOAT,10},{"0x2D0",gg.TYPE_FLOAT,15},{"0x2D4",gg.TYPE_FLOAT,9}};
                        local canbuy = {{"0x5D1",gg.TYPE_BYTE,1},{"0x81",gg.TYPR_BYTE,1},{"0x82",gg.TYPE_BYTE,1},{"0x80",gg.TYPE_BYTE,1},{"0x83",gg.TYPE_BYTE,1}};
						if (hooks == 1) then
							function weaponmod()
								wep = gg.choice({
								  "⬅️️ • Back",
					lazer.. "🧪 • Lazer shots",
				 dasher.. "⏭️ • Always dash",
				  chart.. "⏳ • No charge time",
					 exdp.. "💥 • Exploding bullets",
					 recn.. "🔄 • No recoil",
				  igref.. "↪️ • Ignore reflection",
					  oog.. "😲 • Shotgun",
				  melra.. "🗡️ • Inf melee range",
				 	 bozo.. "🧨️ • Bazooka",
				  green.. "💣️ • Grenade launcher",
		   	  fanre.. "️🚬 • Fan rocket",
					 gost.. "👻️ • Ghost"
					}, nil, "🔫 • weapon mods");
								local railgunoffsets = {{"0x1BC",gg.TYPE_BYTE,1},{"0x1C8",gg.TYPE_FLOAT,1}};
                                						function railgun()
      				for i, v in ipairs(railgunoffsets) do
								hackOffset(v[1], v[2], v[3])
							end
          end
                                if (wep == 2) then
									railgun();
									weaponmod();
								end
                                local dashoffset = {{"0x2A8",gg.TYPE_BYTE,1},{"0x2B0",gg.TYPE_FLOAT,5}};
                                						function dash()
       				for i, v in ipairs(dashoffset) do
								hackOffset(v[1], v[2], v[3]);
							end
		  		end
				
								if (wep == 3) then
									dash();
									weaponmod();
								end
                                local chargeweptime = {{"0x1E4",gg.TYPE_FLOAT,0}};
                                						function nocharge()
       				for i, v in ipairs(chargeweptime) do
								hackOffset(v[1], v[2], v[3]);
							end
					end
								if (wep == 4) then
									nocharge();
									weaponmod();
								end
                                local bulletexplode = {{"0x1A5",gg.TYPE_BYTE,1}};
                                						function bulletexplodingllet()
       				for i, v in ipairs(bulletexplode) do
								hackOffset(v[1], v[2], v[3]);
							end
					end
								if (wep == 5) then
									bulletexplodingllet()
									weaponmod();
								end
                                local recoil = {{"0xC0",gg.TYPE_FLOAT,0}};
                                						function downrec()
       				for i, v in ipairs(recoil) do
								hackOffset(v[1], v[2], v[3]);
							end
					end
								if (wep == 6) then
									downrec();
									weaponmod();
								end
                                local ignorereflect = {{"0x128",gg.TYPE_BYTE,1},{"0x129",gg.TYPE_BYTE,1},{"0x12A",gg.TYPE_BYTE,1}};
                                						function reflect()
       				for i, v in ipairs(ignorereflect) do
								hackOffset(v[1], v[2], v[3]);
							end
					end
								if (wep == 7) then
									reflect();
									weaponmod();
								end
                                local shotgunn = {{"0x1A6",gg.TYPE_BYTE,1}};
                                						function shotguns()
       				for i, v in ipairs(shotgunn) do
								hackOffset(v[1], v[2], v[3]);
							end
					end
								if (wep == 8) then
									shotguns();
									weaponmod();
								end
                                local isrange = {{"0x184",gg.TYPE_FLOAT,bigFloat}};
                                						function melee()
       				for i, v in ipairs(isrange) do
								hackOffset(v[1], v[2], v[3]);
							end
					end
								if (wep == 9) then
									melee();
									weaponmod();
								end
                                local bazoo = {{"0x12B",gg.TYPE_BYTE,1}};
                                						function booz()
       				for i, v in ipairs(bazoo) do
								hackOffset(v[1], v[2], v[3]);
							end
					end
								if (wep == 10) then
									booz();
									weaponmod();
								end
                                local grenade = {{"0x158",gg.TYPE_BYTE,1}};
                                						function launch()
       				for i, v in ipairs(grenade) do
								hackOffset(v[1], v[2], v[3]);
							end
					end
								if (wep == 11) then
									launch();
									weaponmod();
								end
                                local fan = {{"0x16D",gg.TYPE_BYTE,1}};
                                						function rocketf()
       				for i, v in ipairs(fan) do
								hackOffset(v[1], v[2], v[3]);
							end
					end
								if (wep == 12) then
									rocketf();
									weaponmod();
								end
                                local ghost = {{"0x156",gg.TYPE_BYTE,1}};
                                						function ghosty()
       				for i, v in ipairs(ghost) do
								hackOffset(v[1], v[2], v[3]);
							end
					end
								if (wep == 13) then
									ghosty();
									weaponmod();
								end
								if (wep == 1) then
									Hooky();
								end
								if (wep == nil) then
									gg.setVisible(false);
									while true do
										if gg.isVisible(true) then
											gg.setVisible(false);
											weaponmod();
										end
									end
								end
							end
							weaponmod();
						end
						if (hooks == 2) then
							function uti()
								uto = gg.choice({
								  "⬅️️ • Back",
				killer..  "💀 • Kill all",
			   silam..  "🩸 • Silent aim",
				 scrin..  "♾️ • Infinite score",
			 	  coti..  "💯 • Crit",
				  inbs..  "👻 • Invisible on kill/reload/charge/respawn",
				 spedb..  "🏃 • Speedboost after kill",
				 muchd..  "🔰 • 10x dmg",
				  god1..  "🧬 • Godmode[test]",
				 ceend..  "💰 • Coin drop[test]",
					xroy..  "👁️ • Xray[test]",
			   focju..  "⏫️ • Force double jump",							  
					}, nil, "🛡️ • Utilities");
								if (uto == 1) then
									Hooky();
								end
                                local killAllActive = {{"0x369",gg.TYPE_BYTE,1},{"0x36C",gg.TYPE_FLOAT,5},{"0x370",gg.TYPE_FLOAT,99999}};
                                						function killAll()
       				for i, v in ipairs(killAllActive) do
								hackOffset(v[1], v[2], v[3]);
							end
					end
								if (uto == 2) then
									killAll();
									uti();
								end
                                local roundMelee = {{"0x191",gg.TYPE_BYTE,1},{"0x192",gg.TYPE_FLOAT,bigFloat},{"0x184",gg.TYPE_FLOAT,bigFloat}};
														function silentAim()
							for i, v in ipairs(roundMelee) do
								hackOffset(v[1], v[2], v[3]);
							end
					end
                                if (uto == 3) then
									silentAim();
									uti();
								end
                                local infScoreOffets = {{"0x38C",gg.TYPE_BYTE,1},{"0x398",gg.TYPE_FLOAT,99999}};
                                						function infScore()
       				for i, v in ipairs(infScoreOffets) do
								hackOffset(v[1], v[2], v[3]);
							end
					end
								if (uto == 4) then
									infScore();
									uti();
								end
                                local critoffsets = {{"0x47C",gg.TYPE_DWORD,99999}};
                                						function crit()
       				for i, v in ipairs(critoffsets) do
								hackOffset(v[1], v[2], v[3]);
							end
					end
								if (uto == 5) then
									crit();
									uti();
								end
                                local invbl = {{"0x385",gg.TYPE_BYTE,1},{"0x1E8",gg.TYPE_BYTE,1},{"0x37C",gg.TYPE_BYTE,1},{"0x37D",gg.TYPE_BYTE,1},{"0x380",gg.TYPE_FLOAT,bigFloat},{"0x388",gg.TYPE_FLOAT,bigFloat}};
                                						function invis()
       				for i, v in ipairs(invbl) do
								hackOffset(v[1], v[2], v[3]);
							end
					end
								if (uto == 6) then
									invis();
									uti();
								end
                                local isfast = {{"0x438",gg.TYPE_BYTE,1},{"0x444",gg.TYPE_FLOAT,bigFloat},{"0x43C",gg.TYPE_FLOAT,10}};
                                						function fastest()
       				for i, v in ipairs(isfast) do
								hackOffset(v[1], v[2], v[3]);
							end
					end
								if (uto == 7) then
									fastest();
									uti();
								end
                                local gundmgoffsets = {{"0x3BC",gg.TYPE_BYTE,1},{"0x3C0",gg.TYPE_FLOAT,2.5},{"0x3C4",gg.TYPE_FLOAT,5},{"0x3C8",gg.TYPE_FLOAT,2.5},{"0x3CC",gg.TYPE_FLOAT,50}};
                                						function dmg()
      				for i, v in ipairs(gundmgoffsets) do
								hackOffset(v[1], v[2], v[3]);
							end
			    end 
								if (uto == 8) then
									dmg();
									uti();
								end
                                local godm = {{"0x311",gg.TYPE_BYTE,1},{"0x1E9",gg.TYPE_BYTE,1},{"0x1EA",gg.TYPE_BYTE,1},{"0x1EC",gg.TYPE_FLOAT,9999},{"0x3EC",gg.TYPE_BYTE,1},{"0x3F0",gg.TYPE_FLOAT,100},{"0x3F4",gg.TYPE_FLOAT,bigFloat},{" 0x20D",gg.TYPE_BYTE,1},{"0x5A4",gg.TYPE_BYTE,1},{"0x5A5",gg.TYPE_BYTE,1},{"0x5A8",gg.TYPE_FLOAT,9999}};
                                						function god()
      				for i, v in ipairs(godm) do
								hackOffset(v[1], v[2], v[3]);
							end
					end
								if (uto == 9) then
									god();
									uti();
								end
                                local coindrop = {{"0x330",gg.TYPE_BYTE,1},{"0x334",gg.TYPE_FLOAT,100}};
                                						function richasf()
      				for i, v in ipairs(coindrop) do
								hackOffset(v[1], v[2], v[3]);
							end
					end
								if (uto == 10) then
									richasf();
									uti();
								end
                                local rayx = {{"0x24B",gg.TYPE_BYTE,1},{"0x24C",gg.TYPE_BYTE,1},{"0x24D",gg.TYPE_BYTE,1},{"0x250",gg.TYPE_FLOAT,0},{"0xC6",gg.TYPE_BYTE,1},{"0xC5",gg.TYPE_BYTE,1}};
                                						function rays()
      				for i, v in ipairs(rayx) do
								hackOffset(v[1], v[2], v[3]);
							end
					end
								if (uto == 11) then
									rays();
									uti();
								end
                                local forcejump = {{"0x477",gg.TYPE_BYTE,1}};
                                						function double()
      				for i, v in ipairs(forcejump) do
								hackOffset(v[1], v[2], v[3]);
							end
					end
								if (uto == 12) then
									double();
									uti();
								end
								

								if (uto == nil) then
									gg.setVisible(false);
									while true do
										if gg.isVisible(true) then
											gg.setVisible(false);
											uti();
										end
									end
								end
							end
							uti();
						end
						if (hooks == 3) then
							function effective()
								effecto = gg.choice({
								  "⬅️️ • Back",
         pooly..  "🐜 • Polymorph",
        maghed..  "🔎 • Magnify head",
         posef..  "💉 • Poison effect",
          blin..  "👀 • Blindness effect",
          imef..  "🦠 • Immune to effects[not all]",
          tare..  "💣 • Target explode on kill",
         chams..  "💘 • Charm",
          wekn..  "💪 • Weakness",
          elcs..  "🌩️ • Electric Shock",
          slwd..  "⏪ • Slow down",
          coss..  "🔮 • Curse",
          disj..  "🩼 • Disable jump",
         disga..  "🛠️ • Disable gadget"
					}, nil, "🔮 • Effects");
								if (effecto == 1) then
									Hooky();
								end
								if (effecto == nil) then
									gg.setVisible(false);
									while true do
										if gg.isVisible(true) then
											gg.setVisible(false);
											effective();
										end
									end
								end
                                local polymorpherOffsets = {{"0x2EC",gg.TYPE_BYTE,1},{"0x2F0",gg.TYPE_FLOAT,bigFloat},{"0x3D8",gg.TYPE_DWORD,0},{"0x2F8",gg.TYPE_FLOAT,bigFloat},{"0x2B8",gg.TYPE_BYTE,1},{"0x2E0",gg.TYPE_FLOAT,bigFloat},{"0x2D8",gg.TYPE_FLOAT,bigFloat}};
                                						function polymorpher()
      				for i, v in ipairs(polymorpherOffsets) do
								hackOffset(v[1], v[2], v[3]);
							end
					end
								if (effecto == 2) then
									polymorpher();
									effective();
								end
                                local bighead = {{"0x260",gg.TYPE_BYTE,1},{"0x264",gg.TYPE_FLOAT,bigFloat}};
                                						function bigger()
      				for i, v in ipairs(bighead) do
								hackOffset(v[1], v[2], v[3]);
							end
					end
								if (effecto == 3) then
									bigger();
									effective();
								end
                                local poison = {{"0x1F8",gg.TYPE_BYTE,1},{"0x200",gg.TYPE_FLOAT,bigFloat},{"0x204",gg.TYPE_FLOAT,bigFloat}};
                                						function pois()
      				for i, v in ipairs(poison) do
								hackOffset(v[1], v[2], v[3]);
							end
					end
								if (effecto == 4) then
									pois();
									effective();
								end
                                local blindash = {{"0x268",gg.TYPE_BYTE,1},{"0x270",gg.TYPE_FLOAT,bigFloat}};
                                						function youcantsee()
      				for i, v in ipairs(blindash) do
								hackOffset(v[1], v[2], v[3]);
							end
					end
								if (effecto == 5) then
									youcantsee();
									effective();
								end
                                local effectim = {{"0x248",gg.TYPE_BYTE,1},{"0x249",gg.TYPE_BYTE,1},{"0x24A",gg.TYPE_BYTE,1}};
                                						function immune()
      				for i, v in ipairs(effectim) do
								hackOffset(v[1], v[2], v[3]);
							end
					end
								if (effecto == 6) then
									effective();
									immune();
								end
                                local isexplode = {{"0x318",gg.TYPE_BYTE,1},{"0x324",gg.TYPE_FLOAT,bigFloat},{"0x31C",gg.TYPE_FLOAT,bigFloat},{"0x320",gg.TYPE_FLOAT,0}};
                                						function death()
      				for i, v in ipairs(isexplode) do
								hackOffset(v[1], v[2], v[3]);
							end
					end
								if (effecto == 7) then
									death();
									effective();
								end
                                local charm = {{"0x274",gg.TYPE_BYTE,1},{"0x278",gg.TYPE_BYTE,1}};
                                					    function charming()
      				for i, v in ipairs(charm) do
								hackOffset(v[1], v[2], v[3]);
							end
					end
								if (effecto == 8) then
									charming();
									effective();
								end
                                local weak = {{"0x27C",gg.TYPE_BYTE,1},{"0x280",gg.TYPE_FLOAT,bigFloat}};
                                						function weakash()
          		for i, v in ipairs(weak) do
								hackOffset(v[1], v[2], v[3]);
							end
					end
								if (effecto == 9) then
									weakash();
									effective();
								end
                                local shocker = {{"0x42C",gg.TYPE_BYTE,1},{"0x430",gg.TYPE_FLOAT,9999},{"0x434",gg.TYPE_FLOAT,9999}};
                                						function sens()
           		for i, v in ipairs(shocker) do
								hackOffset(v[1], v[2], v[3]);
							end
					end
								if (effecto == 10) then
									sens();
									effective();
								end
                                local slow = {{"0x224",gg.TYPE_BYTE,1},{"0x228",gg.TYPE_FLOAT,10},{"0x22C",gg.TYPE_FLOAT,9999},{"0x230",gg.TYPE_BYTE,1}};
                                						function slowash()
							for i, v in ipairs(slow) do
								hackOffset(v[1], v[2], v[3]);
							end
					end
								if (effecto == 11) then
									slowash();
									effective();
								end
                                local curse = {{"0x214",gg.TYPE_BYTE,1},{"0x218",gg.TYPE_FLOAT,9999},{"0x21C",gg.TYPE_FLOAT,9999}};
                                						function cursed()
  						for i, v in ipairs(curse) do
								hackOffset(v[1], v[2], v[3]);
							end
					end
								if (effecto == 12) then
									cursed();
									effective();
								end
                                local disablej = {{"0x20E",gg.TYPE_BYTE,1},{"0x210",gg.TYPE_FLOAT,9999}};
                                				  	    function nojump()
    					for i, v in ipairs(disablej) do
								hackOffset(v[1], v[2], v[3]);
							end
					end
								if (effecto == 12) then
									nojump();
									effective();
								end
                                local gadget = {{"0x1F0",gg.TYPE_BYTE,1},{"0x1F4",gg.TYPE_FLOAT,9999}};
                                						function byegad()
 						for i, v in ipairs(gadget) do
								hackOffset(v[1], v[2], v[3]);
              end
					end
								if (effecto == 13) then
									byegad();
									effective();
								end
							end
							effective();
						end
						if (hooks == 4) then
							yes();
						end
						if (hooks == nil) then
							gg.setVisible(false);
							while true do
								if gg.isVisible(true) then
									gg.setVisible(false);
									Hooky();
								end
							end
						end
					end
					Hooky();
 end
 
------------------------------------------------------------------------------
 
--nonhooks--
 if (gameplay == 2) then
	    function non()
	      
	      
	    nonhook = gg.choice({
	              inf..   "🎗 • Infinite ammo",
	              fir..   "☄️ • Fire rate",
	              rel..   "🔄 • Reload speed[does not work anymore",
	              gcd..   "⏱️ • No gadget cooldown",
	              tem..   "☠️ • Teamkill",
	              swe..   "🤬 • No swear filter",
	              god..   "💀 • Godmode[test]",
	              tgod..  "🤖 • Turrent godmode[test]",
	              petr..  "🙀 • No pet respawn time[test]",
                menu..  "💵 • reward multi(part 1)",
	             xrewm..  "💵 • reward multi [below 65 only] (part 2)",
	             xrewm..  "💵 • reward multi [lvl65 only] (part 2)",
	                      "⬅️️ • Back"
	                },nil,"📢 • Non hooks")

--ammo--
	if nonhook == 1 then
	if inf==OFF then 
	   Patch("libil2cpp.so",I[28],"20008052C0035FD6")
	   inf=ON else
        Restore("libil2cpp.so",I[28]) 
        inf=OFF
        gg.toast("Reverted")
    end
    non()
	end
	
--fire rate--
  if nonhook == 2 then
   if fir==OFF then 
      Patch("libil2cpp.so",I[24],"E07B40B2C0035FD6")
      fir=ON else
        Restore("libil2cpp.so",I[24]) 
        fir=OFF
        gg.toast("Reverted")
    end
    non()
	end
  
--reload speed--
  if nonhook == 3 then 
gg.alert("patched")
non()
  end
  
--gadget cooldown--
  if nonhook == 4 then
 if gcd==OFF then 
    Patch("libil2cpp.so",I[18],"20008052C0035FD6")
    Patch("libil2cpp.so",I[19],"20008052C0035FD6")
    gcd=ON else
        Restore("libil2cpp.so",I[19]) 
        Restore("libil2cpp.so",I[18])
        gcd=OFF
        gg.toast("Reverted")
    end
    non()
  end

--teamkill--  
  if nonhook == 5 then
     if tem==OFF then o=I[26] 
        Patch("libil2cpp.so",I[26],"00008052C0035FD6") 
        Patch("libil2cpp.so",I[27],"00008052C0035FD6")
        tem=ON else
        Restore("libil2cpp.so",I[26]) 
        Restore("libil2cpp.so",I[27]) 
        tem=OFF
        gg.toast("Reverted")
    end
    non()
  end
  
--swear filter--
  if nonhook == 6 then
   if swe==OFF then 
      Patch("libil2cpp.so",I[28],"00008052C0035FD6")
      swe=ON else
        Restore("libil2cpp.so",I[28]) 
        swe=OFF
        gg.toast("Reverted")
    end
    non()
  end
  
--godmode--
  if nonhook == 7 then
         if god==OFF then 
            Patch("libil2cpp.so",I[29],"C0035FD6")
            Patch("libil2cpp.so",I[30],"C0035FD6")
            Patch("libil2cpp.so",I[31],"C0035FD6")
            Patch("libil2cpp.so",I[32],"C0035FD6")
            god=ON else
        Restore("libil2cpp.so",I[29]) 
        Restore("libil2cpp.so",I[30]) 
        Restore("libil2cpp.so",I[31]) 
        Restore("libil2cpp.so",I[32])       
        god=OFF
        gg.toast("Reverted")
    end
    non()
  end
  
--turrentgod--  
  if nonhook == 8 then
         if tgod==OFF then 
            Patch("libil2cpp.so",I[33],"C0035FD6")
            Patch("libil2cpp.so",I[34],"C0035FD6")
            Patch("libil2cpp.so",I[35],"C0035FD6")
            tgod=ON else
        Restore("libil2cpp.so",I[33]) 
        Restore("libil2cpp.so",I[34]) 
        Restore("libil2cpp.so",I[35]) 
        tgod=OFF
        gg.toast("Reverted")
    end
    non()
  end

--petrespawn--
  if nonhook == 9 then
   if petr==OFF then 
      Patch("libil2cpp.so",I[36],"00008052C0035FD6")
      petr=ON else
        Restore("libil2cpp.so",I[36])
        petr=OFF
        gg.toast("Reverted")
    end
    non()
  end
  
--multi part 1 
if (nonhook== 10) then
Patch("libil2cpp.so",I[63],"20008052C0035FD6") is2=true
non()
end

--multi part 2					  
if nonhook==11 then
if is2==true then
gg.alert('you will crash if your level 65')
if xrewm==OFF then
Patch('libil2cpp.so',I[42],'600C8052C0035FD6')
xrewm=ON
else
Restore('libil2cpp.so',I[42])
xrewm=OFF
end
else
gg.alert('do part 1 first')
end
non()
end

--restricted multi--
if nonhook == 12 then
lvlres=gg.choice({
"First place on Score Board[x99]",
"Middle place on Score Board[x65]",
"Last place on Score Board","back[x39]"}
,nil,"lvl 65 restricted multiplyer")
if lvlres==1 then
if xrewm==OFF then
Patch('libil2cpp.so',I[42],'E0048052C0035FD6')
xrewm=ON
else
Restore('libil2cpp.so',I[42])
xrewm=OFF
end
end

if lvlres==2 then
if xrewm==OFF then
Patch('libil2cpp.so',I[42],'20088052C0035FD6')
xrewm=ON
else
Restore('libil2cpp.so',I[42])
xrewm=OFF
end
end

if lvlres==3 then
if xrewm==OFF then
Patch('libil2cpp.so',I[42],'600C8052C0035FD6')
xrewm=ON
else
Restore('libil2cpp.so',I[42])
xrewm=OFF
end
end

if lvlres==4 or nil then
non()
end
end

--exit/loop--  
  if nonhook == 13 then
    yes()
  end
  if nonhook == nil then
  gg.setVisible(false)
   while true do 
    if gg.isVisible(true) then
      gg.setVisible(false)
      non()
   end
  end
 end
end
 non()
 end
 
------------------------------------------------------------------------------
 
--gamemodes--
 if (gameplay == 3) then 
   function mode()
     gmode = gg.choice({
       "⚔️️ • Arena",
       "⏫️️ • Parkour challenge",
       "📔️ • Campaign",
       "⬅️️ • Back"
 },nil,"🕹️ • Gamemodes")
   
   --arena--
   if gmode == 1 then
     function aren()
     arena = gg.choice({
  asc.."📶️ • 2b score",
 zomb.."🤢️ • max zombies in wave[2b]",
 zomb.."🤢️ • min zombies in wave[1]",
       "⬅️️ • Back"
 },nil,"⚔️️ • Arena")
   
   
   if arena == 1 then
if asc==OFF then 
    Patch("libil2cpp.so",I[37],"E07B40B2C0035FD6") 
    asc=ON else
        asc=OFF
        gg.toast("Reverted")
end
  aren()
end
      
   if arena == 4 then
     mode()
   end
     if arena == nil then
     gg.setVisible(false)
   while true do 
    if gg.isVisible(true) then
      gg.setVisible(false)
      aren()
   end
  end
 end
   end
   aren()
     end

   --parkour--
   if gmode == 2 then
     function runner()
     race = gg.choice({
      checkc.. "✅ • 2b free checkpoints",
               "⬅️️ • Back"
     },nil,"⏫️️ • Parkour challenge")
   if race == 1 then
if checkc==OFF then Patch("libil2cpp.so",I[38],"E07B40B2C0035FD6") 
    checkc=ON else
        Restore("libil2cpp.so",I[38]) 
        checkc=OFF
        gg.toast("Reverted")
end    
  runner()
end
   end
   if race == 2 then
     mode()
   end
   if race == nil then
     gg.setVisible(false)
   while true do 
    if gg.isVisible(true) then
      gg.setVisible(false)
      runner()
   end
  end
 end
 runner()
   end
  
--campaign
if gmode== 3 then 
  pan= gg.choice({
       "📔️ • unlock all worlds",
       "⬅️️ • Back"
 },nil,"📔️ • Campaign")
if pan == 1 then
Patch("libil2cpp.so",I[51],"20008052C0035FD6")
end
if pan == 2 then 
  yes()
end
if pan == nil then 
  yes()
end
end
   if gmode == 4 then
     yes()
   end   
   if gmode == nil then
     gg.setVisible(false)
   while true do 
    if gg.isVisible(true) then
      gg.setVisible(false)
      mode()
   end
  end
 end
end
mode()
end
 end
  yes()
end

------------------------------------------------------------------------------

--misc--
function ch5()
local misc = gg.choice({
    '⬅️️ • Back',
    '💨 • Update bypass[you dont actually need this]',
    '🏃️ • Game speed',
    '🆔 • id spoof',
    '🤡 • Everyone fall through map',
    '☠️ • Ban[yourself]'
 }
,nil, "🌐 • Misc")

--exits--
if misc == 1 then 
 HOME()
end

if misc == nil then
 HOME()
end

--update bypass--
if misc == 2 then
function updater()
gg.alert("make sure search helper is off")
gg.alert("pause the game using game guardian at 50-75% then you are good to use update bypass")
version = gg.choice({"🔄 • edit version"},nil,'💨 • Update bypass[you dont actually need this]')
if version == 1 then
	prompt = gg.prompt({'current version', 'latest version'}, {'23.3.2', '23.7.2'}, {'text'})
	
	if prompt ~= nil then
		gg.clearResults()
		gg.setRanges(gg.REGION_ANONYMOUS)
		gg.searchNumber(";" .. prompt[1], gg.TYPE_WORD)
		gg.getResults(gg.getResultCount())
		gg.editAll(";" .. prompt[2], gg.TYPE_WORD)
		gg.clearResults()
	end
end
if version == nil then 
  ch5()
end
end
updater()
end

--gamespeed--
if misc == 3 then

prompt = gg.prompt({'Put the speed you want'},{'2'},{'number'})

gg.setVisible(false)
gg.setRanges(gg.REGION_ANONYMOUS | gg.REGION_C_ALLOC)
gg.clearResults()
gg.searchNumber("0000803FrD;ABAAAA3ErD;8FC2F53CrD::9", gg.TYPE_DWORD)
gg.refineNumber("1065353216", gg.TYPE_DWORD)
values = gg.getResults(gg.getResultsCount())
gg.editAll("1,065,353,216", gg.TYPE_DWORD)

t = {}
t[1] = {}
t[1].address = values[1].address + 0
t[1].flags = gg.TYPE_FLOAT
t[1].value = prompt[1]
t[1].freeze = false
gg.setValues(t)
gg.setVisible(false)

if gg.getResultsCount(values) ~= 0 then
	gg.clearResults()
	
	gg.toast("Speedheck Activated!")
end
return
end

--id spoof--
if misc == 4 then
function bypass()
    gg.setVisible(false)
    gg.clearResults()
    gg.sleep(300)
    eval = gg.choice ({"spoof id"},nil,"🆔 • id spoof")
    if eval == 1 then
        spoof_id()
    end
    gg.alert("you have to be out of the game")
    gg.clearResults()
    gg.setRanges(gg.REGION_CODE_APP)
    gg.searchNumber("h F4 0F 1E F8 F3 7B 01 A9 93 79 02 F0 14 54 02 B0 68 32 63 39 94 9A 43 F9 C8 00 00 37 00 54 02 B0 00 98 43 F9 76 03 D9 97 28 00 80 52 68 32 23 39 80 02 40 F9 08 E0 40 B9 48 00 00 35 AC 03 D9 97", gg.TYPE_BYTE)
    gg.getResults(gg.getResultCount())
    gg.editAll("E0018052C0035FD6",gg.TYPE_BYTE)
    gg.clearResults()
    gg.sleep(500)
    gg.processResume()
 
    spoof_id()
end

function spoof_id()
    gg.setVisible(false)
    gg.alert("Press GG Icon when u copied ID and ready to spoof ID")
    while gg.isVisible() == false do 
    --wait
    end
    local var = 0
    local spoofed = 999999999
    gg.setVisible(false)
    gg.clearResults()
    local uid = gg.prompt({"Paste ur ID"}, nil, {'number'}) 
    if uid == nil then
        print("ID spoof cancelled")
        return
    end
    for i=1,10 do 
        gg.setRanges(gg.REGION_ANONYMOUS)
        gg.searchNumber(";" ..uid[1],gg.TYPE_WORD)
        gg.getResults(1000)
        if gg.getResultsCount() == 0 then 
            break 
        end
        gg.editAll(";" ..spoofed,gg.TYPE_WORD)
        gg.clearResults()
    end
    print("Done")
    return
end

bypass()
gg.setVisible(false)
print("Script finished!")
end

--map fall--
if misc == 5 then 
    gg.clearResults()
    gg.searchNumber("-1,055,066,685", gg.TYPE_DWORD)
    gg.getResults(100000)   
    gg.editAll("-2", gg.TYPE_DWORD)
    gg.clearResults()
end

--ban--
if misc == 6 then
ban = gg.choice({'😲 | ban me','😢 | no I dont want to be banned'},nil,"☠️ • Ban[yourself]")
 if ban == 1 then
   gg.alert("After use, close the game and restart. Now you should be banned.")

    gg.setRanges(gg.REGION_ANONYMOUS)
    gg.searchNumber('280', gg.TYPE_FLOAT)
    gg.getResults(32)
    gg.editAll('1', gg.TYPE_FLOAT)
    end
    
    if ban == nil then
  ch5()
end

   if ban == 2 then
     ch5()
    end
  end
end

------------------------------------------------------------------------------

--info--
function changes()
  change = gg.choice({
questions.."🗂️️ • Changelogs",
important.."📑️ • Policies",
questions.."📁️ • Notes",
questions.."📇️ • Dev info",
important.."📌️ • Credits",
important.."❓ • Report Questions/Problems",
           "⬅️️ • Back"
     },nil,"🗓️ • info")

--changelog--
if change == 1 then
ghsj = gg.choice({
    "#changes#",
    "",
    "::thurs sept 7::",
    "• fixed menu functionality and features that were not working",
    "• prepared menu for more additional features",
    "::fri sep 8::",
    "• added more features including:",
    "  - arena menu with ability to change wave level and points",
    "  - parkour menu with the ability to set checkpoint price and free checkpoint amount[adding more soon]",
    "• added an info option with changelogs ans stuff",
    "::thu sep 14::",
    "• added some features and updated the whole menu to 23.7.0",
    "::tue sep 26::",
    "• reworked and updated the whole menu",
    "• added an on/off switch",
    "::wed sep 27::",
    "• fixed the revert feature and added more features",
    "• fixed graffiti unlocker",
    "::thu sep 28::",
    "• fixed the follwing features",
    "  - coupon clicker",
    "  - royal unlocker",
    "  - weapon skin unlocker",
    "• added on/off functions to gameplay options",
    "• prepared for login",
    "::sun oct 1::",
    "• merged with judsn and worked on security",
    "::mon oct 2::",
    "• imlemented a securety system so only users who bought can access"
},nil,"changelog")
end

--policies--
if change == 2 then
ppg = gg.choice({
    "::policies::",
    "",
    "--by reading this you agreed to accept all termination of access to this menu for the following actions",
    "--you also will have to agree to the use of storing ips--",
    "   • trying to give away/exchange the menu",
    "   • attempting to skid any portions of the menu",
    "   • being disrespectful to anyone associated with me"}
    ,nil)
end

--general info--
if change == 3 then
chng = gg.choice({
    "Some features have been patched including",
    "   • collectibles[lottery and cracked collectibles still works",
    "   • level spoofer[we made a new one]",}
    ,nil,"info")
end

--dev info--
if change == 4 then
  gg.alert("we are people")
end

--credits--
if change == 5 then 
  gg.choice({
    "credits to:",
    "zygisk",
    "fede",
    "matt",
    "dari",
    "everyone in judsn, ",
    "and lasly myself[herx]",})
end

--reports-
if change == 6 then
  gg.alert("all these questions will be directly sent to menu chat in the discord server!!")
local report = gg.prompt({'what is your discord user: ','Report: '},nil,{'text','text'})

if report then
local discordWebhookUrlqna = "https://discord.com/api/webhooks/1158527839763705886/sdkQExtD6Pag35pAhe3x89bf4Kb3vbBc0JPHdN3ivpRzyLn9EkiZQEKaIsXCU8k1SIr_"
----------------------------------------------------------------
function SendQuestionToDiscord()
    
-- Construct the message content
local messageContent = "User: "..report[1].."\\n".."Report: ".. report[2]
-- Prepare the request payload
local payload = {
    content = messageContent
}
-- Encode payload to JSON
local payloadJson = '{"content":"' .. messageContent .. '"}'
-- Prepare the request
local headers = {
    ["Content-Type"] = "application/json"
}

-- Send the message
local Que = gg.makeRequest(discordWebhookUrlqna, headers, payloadJson)

-- Check the response
if Que.error then
    gg.alert("Error: " .. Que.content .. "\n" .. "Please try again")
else
    gg.alert("Report Sent!!!")
end
end

-- Send the message to Discord

SendQuestionToDiscord()
end
end

if change == nil then 
  HOME()
end
if change == 7 then 
  HOME() 
end
end

function tools()
  gg.alert("coming soon :)")
  HOME()
end

------------------------------------------------------------------------------


--funcion calls--
if imdev==true then
if multi == nil then
 gg.setVisible(false)
  while true do 
    if gg.isVisible(true) then
         gg.setVisible(false)
      HOME()
    end
  end
end
if multi == 1 then ch1() end
if multi == 2 then ch2() end
if multi == 3 then ch3() end
if multi == 4 then ch5() end
if multi == 5 then changes() end
if multi == 6 then tools() end
if multi == 7 then exit() end
  elseif imdev~=true then
if multi == nil then
 gg.setVisible(false)
  while true do 
    if gg.isVisible(true) then
         gg.setVisible(false)
      HOME()
    end
  end
end
if multi == 1 then ch1() end
if multi == 2 then ch2() end
if multi == 3 then ch3() end
if multi == 4 then ch5() end
if multi == 5 then changes() end
if multi == 6 then exit() end
end
end
------------------------------------------------------------------------------

--loop--
cs = 'proplam'
 while(true)do
  if gg.isVisible(true) then
   XGCK=1
   gg.setVisible(false)
 end
gg.clearResults()
  if XGCK==1 then
   HOME()
  end
 end
end

------------------------------------------------------------------------------

--week
local currentTimestamp = os.time()

-- Calculate the expiration timestamp 12 days from now (12 * 24 * 60 * 60 seconds)
local tweexpirationTimestamp = currentTimestamp + (12 * 24 * 60 * 60)

local weekexpirationTimestamp = currentTimestamp + (7 * 24 * 60 * 60)

idk()

------------------------------------------------------------------------------