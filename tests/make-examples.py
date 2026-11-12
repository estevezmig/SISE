import json
from pathlib import Path
base=Path(__file__).resolve().parent.parent

def make(name,variables,steps,transitions,actions):
    v={}
    for n,t,d in variables:
        v['v_'+n]={'id':'v_'+n,'name':n,'type':t,'direction':d}
    ss={}
    for n,kind in steps:
        ss[f's{n}']={'id':f's{n}','number':n,'kind':kind,'position':{'x':200,'y':n*130+50}}
    ts={}
    for i,(before,condition,after) in enumerate(transitions,1):
        ts['t'+str(i)]={'id':'t'+str(i),'number':i,'from':[f's{x}' for x in before],'to':[f's{x}' for x in after],'receptivity':condition,'position':{'x':200,'y':i*130}}
    aa={}
    for i,(step,kind,value,event) in enumerate(actions,1):
        aa['a'+str(i)]={'id':'a'+str(i),'stepId':f's{step}','kind':kind,'text':value,'order':i}
        if event:aa['a'+str(i)]['condition']=event
    p={'schemaVersion':4,'id':'fixture_'+name.replace(' ','_'),'name':name,'meta':{'author':'SISE · ejemplo replicado de especificaciones públicas de GrafcetMaker','company':'','revision':'0.2','createdAt':'2026-11-12T00:00:00Z','updatedAt':'2026-11-12T00:00:00Z'},'variables':v,'grafcets':{'g1':{'id':'g1','name':'Main','kind':'partial','steps':ss,'transitions':ts,'actions':aa,'comments':{}}},'grafcetOrder':['g1']}
    return p

traffic=make('Semaforo', [('request','BOOL','input'),('Red','BOOL','output'),('Yellow','BOOL','output'),('Green','BOOL','output'),('Walk','BOOL','output'),('Req','BOOL','internal')],
 [(0,'initial'),(1,'normal'),(2,'normal')],
 [([0],'10s/X0',[1]),([1],'30s/X1 + Req * 10s/X1',[2]),([2],'3s/X2',[0])],
 [(0,'continuous','Red',None),(0,'continuous','Walk',None),(0,'storedOnActivation','Req := 0',None), (1,'continuous','Green',None),(1,'storedOnEvent','Req := 1','↑request'),(2,'continuous','Yellow',None)])

station=make('Estacion de taladrado', [('start','BOOL','input'),('part','BOOL','input'),('clamped','BOOL','input'),('low','BOOL','input'),('high','BOOL','input'),('released','BOOL','input'),('ack','BOOL','input'),('Clamp','BOOL','output'),('Spin','BOOL','output'),('Down','BOOL','output'),('Up','BOOL','output'),('Service','BOOL','output'),('Count','INT','internal')],
 [(0,'initial'),(1,'normal'),(2,'normal'),(3,'normal'),(4,'normal'),(5,'normal')],
 [([0],'↑start * part',[1]),([1],'clamped',[2]),([2],'low',[3]),([3],'high',[4]),([4],'released * (Count < 100)',[0]),([4],'released * (Count >= 100)',[5]),([5],'↑ack',[0])],
 [(1,'storedOnActivation','Clamp := 1',None),(2,'continuous','Spin',None),(2,'continuous','Down',None),(3,'continuous','Spin',None),(3,'continuous','Up',None),(4,'storedOnActivation','Clamp := 0',None),(4,'storedOnActivation','Count := Count + 1',None),(5,'continuous','Service',None),(5,'storedOnDeactivation','Count := 0',None)])
parallel=make('Paralelo AND', [('start','BOOL','input'),('b1','BOOL','input'),('b2','BOOL','input'),('M1','BOOL','output'),('M2','BOOL','output')],
 [(0,'initial'),(1,'normal'),(2,'normal'),(3,'normal'),(4,'normal'),(5,'normal')],
 [([0],'start',[1,2]),([1],'b1',[3]),([2],'b2',[4]),([3,4],'1',[5]),([5],'2s/X5',[0])],
 [(1,'continuous','M1',None),(2,'continuous','M2',None)])
for filename,data in [('ejemplo_semaforo.grafcet.json',traffic),('ejemplo_taladrado.grafcet.json',station),('ejemplo_paralelo.grafcet.json',parallel)]:
 (base/filename).write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf8')