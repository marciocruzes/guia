import { Observable, Subscription } from 'rxjs/Rx';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Injectable, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Http, Headers, RequestOptions } from '@angular/http';
import 'rxjs/add/operator/map';

import { MensagemService } from './../mensagem/mensagem.service';

//  Classes
import { User } from '../classes/user';
import { AppConfig } from '../app.config';
import { HttpParams } from '@angular/common/http/src/params';
import { tokenNotExpired, JwtHelper } from 'angular2-jwt';

@Injectable()
export class AuthService {

    private userAuth: boolean = false;
    // private httpClient: HttpClient;
    static usuario = new BehaviorSubject('');

    mostrarMenuEmitter = new EventEmitter<boolean>();
    loading = new EventEmitter<boolean>();

	constructor(private http: Http, private httpClient: HttpClient, private router: Router, private config: AppConfig, private jwt: JwtHelper, private mensagem: MensagemService) { }
   
    public gerarToken(strToken: string, urlToken: string){
        const body = {name: this.config.getConfig('name_token'), password:this.config.getConfig('password_token')};
        this.loading.emit(true)
        //Geração do Token
        this.httpClient.post(this.config.getConfig('url_microservice') + this.config.getConfig(urlToken), body).toPromise()
        .then(
            res => {
                if(!!localStorage.getItem(strToken))
                    localStorage.removeItem(strToken)
                    
                localStorage.setItem(strToken, JSON.stringify({ token: res['data']['token'] }));
                this.loading.emit(false);               
            },
            (err: HttpErrorResponse) => {                
                this.mensagem.notify('Infelizmente nosso serviço está indisponível no momento, por favor tente novamente mais tarde', 'alert alert-danger');
                console.error('Erro na geração do Token');
                this.loading.emit(false)
            }
        );
    }
    
    public getToken(strToken: string): string {
        this.loading.emit(false);
        return (!!localStorage.getItem(strToken)) ? JSON.parse(localStorage.getItem(strToken)).token : false;
    }

    // Verifica se o token está expirado
    public isAuthenticated(strToken: string): boolean {
        const tokenv = JSON.parse(localStorage.getItem(strToken)).token;
        return  this.jwt.isTokenExpired(tokenv);

        
    }

    //Verifica e Gera
    public getTokeAnuthenticated(http: Http, strToken: string, urlToken: string){
        if (localStorage.getItem(strToken) === null){
            this.gerarToken(strToken, urlToken);
        }
        else{
            if (this.isAuthenticated(strToken)){
                localStorage.removeItem(strToken);
                this.gerarToken(strToken, urlToken);
            }
        }
    }

    public gerarTokenNew() { 

        const body = {name: this.config.getConfig('name_token'), password:this.config.getConfig('password_token')};
        let url = this.config.getConfig('url_microservice') + this.config.getConfig('url_token');

        if(!!localStorage.getItem('UsuarioPlano')) {

            let token = JSON.parse(localStorage.getItem('UsuarioPlano')).token;
            
            if(this.jwt.isTokenExpired(token)) {
               this._microservicoGerarTokenNew(url, body);
                
            } else {
                // console.log(token);
                return token;
            }
        } else {
            this._microservicoGerarTokenNew(url, body);
        }        
    }

    private _microservicoGerarTokenNew(url, body) {

        this.http.post(url, body).map(res => {
        
            let resultado = JSON.parse(res['_body']);
            // console.log(resultado['data']['token'])
            // console.log(!!localStorage.getItem('UsuarioPlano'))

            if(!!localStorage.getItem('UsuarioPlano')) 
                localStorage.removeItem('UsuarioPlano')                
            
            localStorage.setItem('UsuarioPlano', JSON.stringify({token: resultado['data']['token']}));         

        }, erro => {
            this.mensagem.notify('Erro ao acessar o servidor. Verifique sua conexão ou tente novamente mais tarde', 'alert alert-danger');
            console.error('Erro na geração do Token');
        })

    }

    //
    //  Faz o login passando a classe usuário
    //
	fazerLogin(http: Http, User: User, strToken:string, urlToken: string){        

        if(!!this.getToken(strToken)) {  
            
            let usuario:any = User;   

            // Check Token            
            this.getTokeAnuthenticated(http, strToken, urlToken);
            
            let url = this.config.getConfig('url_microservice') + this.config.getConfig('url_login');
            
            // Requisições por FormData, sempre enviar o "mimeType": "multipart/form-data" no Headers por Http e não por HttpClient.
            let headers:Headers = new Headers({ 'Authorization' : 'Bearer ' + this.getToken(strToken), "mimeType": "multipart/form-data" });   
            
            //Como o input é do tipo number, ele retira os primeiros dois zeros. Converto para string acrescentando os zeros e tomo cuidado de converter o CPF tambem.
            // let numCartaoCPF = (User.numCartao.toString().length == 15) ? "00"+User.numCartao.toString() : + ''+User.numCartao.toString()+'';

            // console.log(User.numCartao)

            let body = new FormData();
            body.append('identificacao', User.numCartao); 
            body.append('senha', User.senha); 

            this.loading.emit(true);

            this.http.post(url, body, {headers: headers}).subscribe(res => {
                //Se conseguiu fazer request, transforma em JSON e para o loading.
                let result = JSON.parse(res['_body']);
                console.log(result)
                this.loading.emit(false) 

                // Verifica tipo de erro
                // Usuário não cadastrado.   
                if (Object.values(result)[0][0]){
                    this.mensagem.notify(Object.values(result)[0][0], 'alert alert-info');
                }
                else {
                    // Verifica tipo de erro
                    // Senha incorreta
                    var keyNames = Object.values(result);               
                    //Variavel para contagem de Carteiras logadas com o mesmo CPF
                    var listLog = 0;

                    if(Object.values(result).length > 1){
                        //Loga o usuário e redireciona a página de contratos.
                        this.loading.emit(false)
                        this.userAuth = true;
                        AuthService.usuario.next(usuario);
                        this.router.navigate(['/contratos']);                   
                    }
                    else{
                        for (var i in keyNames) {
                            // Verifica se o usuário conseguiu logar.
                            
                            if (Object.values(result)[i].logado){
                                                        
                                this.userAuth = true;
                                //Verifica se é somente Odonto
                                if(!!localStorage.getItem('exclusivoOdonto'))
                                    localStorage.removeItem('exclusivoOdonto')
                                localStorage.setItem('exclusivoOdonto', result[Object.keys(result)[0]]['exclusivoOdonto']);
                                // localStorage.setItem('exclusivoOdonto', 'false');
                                // Verifica se é o primeiro acesso do usuário                                                       
                                //if(localStorage.getItem('boasVindas') != 'false'){
                                    //o direciona a tela de boas vindas.
                                    //this.router.navigate(['/boas-vindas']);  
                                //} else {
                                    //o direciona a home.
                                    this.router.navigate(['/painel']);
                                //}
                                this.mostrarMenuEmitter.emit(true);
                                // Guardar o numero do Cartão para SessionStorage
                                

                                sessionStorage.setItem('numCartao', result[Object.keys(result)[0]]['numCartao']);
                                localStorage.setItem('boasVindas','false');
                                localStorage.setItem('cartaoLogado',result[Object.keys(result)[0]]['numCartao']);    
                                localStorage.setItem('senhaLogado',User.senha);   

                            }
                            else{
                                this.mensagem.notify(Object.values(result)[i].mensagem.alerta[0], 'alert alert-danger');
                            }
                        }
                    }
                }
            }, (err) => {

                let resultado = JSON.parse(err['_body']);               
                this.userAuth = false;
                this.mostrarMenuEmitter.emit(false);
                this.loading.emit(false);

                // console.log(resultado)
                if(!!resultado['mensagem']['alerta'])
                    this.mensagem.notify(resultado['mensagem']['alerta'],'alert alert-warning')        
                    
                if(!!resultado['mensagem']['erro'])
                    this.mensagem.notify(resultado['mensagem']['erro'],'alert alert-danger')    
            });
                    
                
        } else {
            // console.log(!!this.getToken()) 
            this.mensagem.notify('Login indisponínel no momento, por favor tente novamente mais tarde.','alert alert-danger')
        }
    }

    //
    //  Recuperar a senha
    //

    recuperarsenha(http: Http, User: User, strToken:string, urlToken: string){


        if(!!this.getToken(strToken)) {
            let JsonEsqueciSenha: any;
            // Check Token
            this.getTokeAnuthenticated(http, strToken, urlToken);

            let url =   this.config.getConfig('url_microservice') + this.config.getConfig('url_esqueci_senha');

            let headers:Headers = new Headers({ 'Authorization' : 'Bearer ' + this.getToken(strToken), "mimeType": "multipart/form-data" });      

            let  body = new FormData();
            body.append('numCartao', "00"+User.numCartao); //Como o input é do tipo number, ele retira os primeiros dois zeros. Converto para string acrescentando os zeros.
            body.append('cpf', User.cpf);
            body.append('email', User.email);
            body.append('dataNascimento', User.dataNascimento);

            console.log(User);

            http.post(url, body, {headers: headers}).subscribe((result) => {
                this.loading.emit(false);
                console.log(result);

                let resultado = JSON.parse(result['_body']);
                console.log(resultado['mensagem']);
                let vMensagem = resultado['mensagem']['alerta'];


                //this.config.mensagemConfirmacao('Uma nova senha foi enviada para seu e-mail cadastrado. Você poderá alterá-la conforme as instruções enviadas.'); 
                if( vMensagem!=null){
                    
                    this.mensagem.notify(vMensagem,'alert alert-warning');
                    
                }else{
                    this.mensagem.notify('Uma nova senha foi enviada para seu e-mail cadastrado. Você poderá alterá-la conforme as instruções enviadas.','alert alert-success');

                }
            
            }, (err) => {
                console.error(err, 'Erro no esqueci a senha');
                this.loading.emit(false);
                
                let resultado = JSON.parse(err['_body']);
                     
                this.config.mensagemConfirmacao(resultado);
            });
        } else {
            this.mensagem.notify('Recuperaçao de Senha indisponível no momento, por favor tente novamente mais tarde.','alert alert-danger')
        }
    }

    //
    //  Alterar a senha
    //

    alterarSenha(http: Http, User: User, strToken: string, urlToken: string){
        
        let JsonEsqueciSenha: any;
        // Check Token
        this.getTokeAnuthenticated(http, strToken, urlToken);
        let headers:Headers = new Headers({ 'Authorization' : 'Bearer ' + this.getToken(strToken), "mimeType": "multipart/form-data" });      

        let  body = new FormData();
        body.append('numCartao', sessionStorage.getItem('numCartao'));
        body.append('senha', User.senha);
        body.append('confirmSenha', User.confirmSenha);

        let url =   this.config.getConfig('url_microservice') + this.config.getConfig('url_alterar_senha');

        http.post(url, body,  { headers: headers }).subscribe((result) => {
            this.loading.emit(false);
            JsonEsqueciSenha = result; 
            let resultado =JSON.parse(Object(result)._body)

            if (resultado.mensagem.alerta){
                console.log(resultado)
                this.mensagem.notify(resultado.mensagem.alerta, 'alert alert-info');
            }
            else{
                console.log(resultado)
                this.mensagem.notify(resultado.mensagem.sucesso, 'alert alert-success');
            }
            }, (err) => {
                let resultado = JSON.parse(Object(err)._body)
                this.mensagem.notify(resultado.mensagem, 'alert alert-danger');
        });
    }

    //
    //  Cadastrar
    //
    cadastrar(http: Http, User: User, strToken:string, urlToken: string){ 
        if(!!this.getToken(strToken)) {
                
            // Check Token
            this.getTokeAnuthenticated(http, strToken, urlToken);
            let headers:Headers = new Headers({ 'Authorization' : 'Bearer ' + this.getToken(strToken), "mimeType": "multipart/form-data" });      

            let  body = new FormData();
            body.append('numCartao', "00"+User.numCartao); //Como o input é do tipo number, ele retira os primeiros dois zeros. Converto para string acrescentando os zeros.
            body.append('cpf', User.cpf);
            body.append('dataNascimento', User.dataNascimento);
            body.append('celular', User.celular);
            body.append('email', User.email);
            body.append('senha', User.senha);
            body.append('confirmSenha', User.confirmSenha);
            console.log(User)
            let url =   this.config.getConfig('url_microservice') + this.config.getConfig('url_cadastrar')
            http.post(url, body,  { headers: headers }).subscribe((result) => {
                // console.log(JSON.parse(result['_body']));
                let resultado = JSON.parse(result['_body']);

                this.config.mensagemConfirmacao(resultado);
                this.loading.emit(false);                    
                
                }, (err) => {
                // console.log(JSON.parse(err['_body']));
                let resultado = JSON.parse(err['_body']);
                
                this.config.mensagemConfirmacao(resultado);
                this.loading.emit(false); 
                
            }), err => {
                console.error(err, 'Erro no cadastro.');
                this.loading.emit(false);
                
                let resultado = JSON.parse(err['_body']);
                     
                this.config.mensagemConfirmacao(resultado);
            };
        } else {
            this.mensagem.notify('Cadastro indisponível no momento, por favor tente novamente mais tarde.','alert alert-danger')
        }
    }

     //
    //  Efetua o logout do usuário.
    //
    entrarsessao(){
        this.loading.emit(false)
        this.userAuth = true;
        this.router.navigate(['/painel']);
    }

    //
    //  Efetua o logout do usuário.
    //
    deslogar(){
        this.userAuth = false;
        this.mostrarMenuEmitter.emit(false);
        this.loading.emit(false);  
        //localStorage.clear();
        localStorage.removeItem('cartaoLogado');
        localStorage.removeItem('senhaLogado');
        //localStorage.setItem('cartaoLogado', null );    
        //localStorage.setItem('senhaLogado',null); 
        sessionStorage.clear();
        localStorage.setItem('boasVindas','false');
        this.router.navigate(['/login2']);
    }
    //
    //  Retorna o usuário
    //
	getUserAuth(){
		return this.userAuth;
	}

    boasVindasAntes(){
        this.router.navigate(['/boas-vindas']);
    }
}
