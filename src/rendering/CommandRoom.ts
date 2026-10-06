import { Engine, Scene, FreeCamera, Vector3, HemisphericLight, Color3, MeshBuilder, StandardMaterial, DynamicTexture, Texture, WebXRDefaultExperience, WebXRSessionManager, WebXRState, type AbstractMesh } from '@babylonjs/core';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF';
import { AdvancedDynamicTexture, Grid, StackPanel, TextBlock, Button, Control } from '@babylonjs/gui';
import type { SessionController } from '../session/SessionController';
import type { ExerciseAction } from '../training/Exercise';
import { assetUrl } from '../routing';

export class CommandRoom {
  private engine:Engine;
  private scene:Scene;
  private camera:FreeCamera;
  private xr?:WebXRDefaultExperience;
  private disposed=false;
  private unsubscribe?:()=>void;
  private nextUpdate=0;
  private selectedIndex=0;
  private status!:TextBlock;
  private evidence!:TextBlock;
  private message!:TextBlock;
  private buttons:Button[]=[];
  private radar?:DynamicTexture;
  constructor(canvas:HTMLCanvasElement,private controller:SessionController,private callbacks:{ready:()=>void;error:(message:string)=>void;xr:(supported:boolean)=>void;notice:(message:string)=>void}){
    const context=canvas.getContext('webgl2',{antialias:true,alpha:false});if(!context)throw new Error('WebGL2 is unavailable. Use the focused desktop console.');
    this.engine=new Engine(context,true);this.scene=new Scene(this.engine);this.scene.clearColor.set(.035,.065,.08,1);
    this.camera=new FreeCamera('seated operator',new Vector3(0,1.7,-1.4),this.scene);this.camera.setTarget(new Vector3(0,1.95,2.7));this.camera.minZ=.08;this.camera.fov=1.1;this.camera.attachControl(canvas,true);this.camera.inputs.removeByType('FreeCameraKeyboardMoveInput');
    const light=new HemisphericLight('room ambient',new Vector3(0,1,0),this.scene);light.intensity=.9;
    window.addEventListener('resize',this.resize);
    this.engine.onContextLostObservable.add(()=>{this.controller.pause('renderer-context-lost');callbacks.error('Graphics context lost. Return to the focused console.');});
    void this.initialize().catch(error=>{if(!this.disposed)callbacks.error(String(error));});
  }
  private resize=()=>this.engine.resize();
  private async initialize(){
    const container=await LoadAssetContainerAsync(assetUrl('./assets/command-room/room.glb'),this.scene);if(this.disposed){container.dispose();return;}container.addAllToScene();
    this.buildScreens();this.update();this.unsubscribe=this.controller.subscribe(()=>{this.nextUpdate=0;});
    this.engine.runRenderLoop(()=>{if(this.disposed)return;const now=performance.now();if(now>=this.nextUpdate){this.update();this.nextUpdate=now+250;}this.scene.render();});
    this.callbacks.ready();
    const supported=await WebXRSessionManager.IsSessionSupportedAsync('immersive-vr').catch(()=>false);if(this.disposed)return;this.callbacks.xr(supported);
    if(supported){this.xr=await WebXRDefaultExperience.CreateAsync(this.scene,{disableDefaultUI:true,disableTeleportation:true,disableHandTracking:true,disableNearInteraction:true,floorMeshes:container.meshes.filter(mesh=>mesh.name.toLowerCase().includes('floor')) as AbstractMesh[]});if(this.disposed){this.xr.dispose();return;}this.xr.baseExperience.onStateChangedObservable.add(state=>{if(state===WebXRState.IN_XR)this.controller.recordInputMode('vr');if(state===WebXRState.NOT_IN_XR){this.controller.pause('xr-session-ended');this.controller.recordInputMode('desktop');}});}
    if(new URLSearchParams(location.search).has('qa'))Object.assign(window,{__roomQA:{ready:()=>true,resources:()=>({meshes:this.scene.meshes.length,textures:this.scene.textures.length}),action:(action:ExerciseAction)=>this.controller.exerciseAction(action)}});
  }
  private screen(name:string,position:Vector3,width:number,height:number){const mesh=MeshBuilder.CreatePlane(name,{width,height},this.scene);mesh.position=position;return mesh;}
  private text(name:string,height:string,size:number){const text=new TextBlock(name);text.height=height;text.color='#d8e5df';text.fontSize=size;text.fontFamily='monospace';text.textWrapping=true;text.textHorizontalAlignment=Control.HORIZONTAL_ALIGNMENT_LEFT;text.paddingLeft='25px';text.paddingRight='20px';return text;}
  private button(panel:StackPanel,label:string,action:()=>void){const button=Button.CreateSimpleButton(label,label);button.height='95px';button.paddingTop='7px';button.paddingBottom='7px';button.color='#e2ece4';button.background='#203e49';button.thickness=1;button.fontSize=34;button.onPointerClickObservable.add(action);panel.addControl(button);this.buttons.push(button);return button;}
  private buildScreens(){
    const wall=this.screen('operator interactive wall',new Vector3(0,1.99,2.70),4.2,2.1),ui=AdvancedDynamicTexture.CreateForMesh(wall,2048,1024,true);ui.background='#0d202a';
    const grid=new Grid();grid.addColumnDefinition(.34);grid.addColumnDefinition(.33);grid.addColumnDefinition(.33);ui.addControl(grid);
    const panels=[0,1,2].map(column=>{const panel=new StackPanel();panel.width='97%';panel.verticalAlignment=Control.VERTICAL_ALIGNMENT_TOP;grid.addControl(panel,0,column);return panel;});
    this.status=this.text('track status','225px',37);panels[0].addControl(this.status);
    this.button(panels[0],'Select next contact',()=>{this.selectedIndex++;this.update();});
    this.button(panels[0],'Acknowledge',()=>this.act({type:'acknowledge-track',contactId:this.contactId()}));
    for(const [type,label] of [['request-eo','Request EO'],['request-rf','Request RF'],['request-roster','Check roster'],['request-history','Movement history']] as const)this.button(panels[0],label,()=>this.act({type,contactId:this.contactId()}));
    this.evidence=this.text('delivered evidence','500px',31);panels[1].addControl(this.evidence);
    const choices={objectType:['unknown','uav','non-uav'],coordination:['unknown','single','multiple-independent','coordinated'],affiliation:['unconfirmed','friendly','unauthorized'],threat:['low','medium','high','critical']};
    for(const [field,values] of Object.entries(choices))this.button(panels[1],`Set ${field}`,()=>{const state=this.controller.getExerciseState(),current=state.assessments[this.contactId()]?.[field as keyof typeof state.assessments[string]];const value=values[(values.indexOf(current??'')+1)%values.length];this.act({type:field==='threat'?'set-threat':field==='objectType'?'set-object-type':field==='coordination'?'set-coordination':'set-affiliation',contactId:this.contactId(),value} as ExerciseAction);});
    this.message=this.text('decision status','170px',33);panels[2].addControl(this.message);
    this.button(panels[2],'Start / resume',()=>{const state=this.controller.getSnapshot();const result=this.controller.command({type:state.status==='ready'?'start':'resume'});this.message.text=result.message;});
    for(const [type,label] of [['verification','Verify'],['monitor','Monitor'],['report','Report'],['alert','Raise alert'],['authorization','Request authority'],['authorized-response','Authorized response']] as const)this.button(panels[2],label,()=>this.act({type,contactId:this.contactId()}));
    this.button(panels[2],'Finish / AAR',()=>this.act({type:'finish'}));
    const radar=this.screen('radar monitor',new Vector3(-2.3,1.24,.91),.67,.40),material=new StandardMaterial('radar screen material',this.scene);this.radar=new DynamicTexture('radar scope',{width:512,height:320},this.scene,false);material.emissiveTexture=this.radar;material.diffuseColor=Color3.Black();material.disableLighting=true;radar.material=material;
    const map=this.screen('map monitor',new Vector3(2.3,1.24,.91),.67,.40),mapMaterial=new StandardMaterial('local imagery display',this.scene);mapMaterial.emissiveTexture=new Texture(assetUrl(`./assets/regions/${this.controller.getSnapshot().postId}/imagery.jpg`),this.scene);mapMaterial.diffuseColor=Color3.Black();mapMaterial.disableLighting=true;map.material=mapMaterial;
  }
  private contactId(){const tracks=this.controller.getExerciseState().tracks;return tracks.length?tracks[this.selectedIndex%tracks.length].id:'';}
  private act(action:ExerciseAction){const result=this.controller.exerciseAction(action);this.message.text=result.message;this.callbacks.notice(result.message);this.update();}
  private update(){if(!this.status)return;const state=this.controller.getExerciseState(),session=this.controller.getSnapshot(),track=state.tracks.find(item=>item.id===this.contactId());this.status.text=`${session.status.toUpperCase()} / ${Math.floor(session.time)} s\n${track?`${track.label}\n${Math.round(track.bearing)}° / ${Math.round(track.rangeMeters)} m\n${track.acknowledged?'ACKNOWLEDGED':'NEW RETURN'}`:'No unusual returns'}`;
    const evidence=state.evidenceByContact[track?.id??'']??[];this.evidence.text=evidence.slice(-3).map(item=>`${item.source.toUpperCase()} / ${Math.floor(item.deliveryTime)}s\n${item.summary}`).join('\n\n')||'Delivered evidence appears here. Select a return, acknowledge and investigate.';
    const assessment=state.assessments[track?.id??'']??{};this.message.text=state.review?`AAR ${Math.round(state.review.overall)}/100\nDetection ${Math.round(state.review.scores.detection)} / classification ${Math.round(state.review.scores.classification)}`:`ASSESSMENT\n${assessment.objectType??'—'} / ${assessment.coordination??'—'}\n${assessment.affiliation??'—'} / ${assessment.threat??'—'}\nAuthority: ${state.authorization[track?.id??'']??'not requested'}`;
    if(this.radar){const context=this.radar.getContext();context.fillStyle='#082330';context.fillRect(0,0,512,320);context.strokeStyle='#80a59a';for(const radius of [55,110,145]){context.beginPath();context.arc(256,160,radius,0,Math.PI*2);context.stroke();}context.fillStyle='#e8d392';context.font='20px monospace';context.fillText('SIMULATED RADAR',18,26);for(const item of state.tracks){const range=Math.min(1,item.rangeMeters/2200)*145,angle=item.bearing*Math.PI/180,x=256+Math.sin(angle)*range,y=160-Math.cos(angle)*range;context.fillRect(x-4,y-4,8,8);context.fillText(item.id,x+8,y);}this.radar.update();}
  }
  async enterVR(){if(!this.xr)throw new Error('No immersive VR session is available. Connect the PC headset and OpenXR runtime, then reload.');await this.xr.baseExperience.enterXRAsync('immersive-vr','local-floor',this.xr.renderTarget);}
  async exitVR(){await this.xr?.baseExperience.exitXRAsync();}
  recenter(){this.camera.position.set(0,1.7,-1.4);this.camera.setTarget(new Vector3(0,1.99,2.7));if(this.xr)this.xr.baseExperience.camera.position.set(0,1.7,-1.4);}
  dispose(){this.disposed=true;this.unsubscribe?.();window.removeEventListener('resize',this.resize);Reflect.deleteProperty(window,'__roomQA');this.xr?.dispose();this.scene.dispose();this.engine.dispose();}
}
