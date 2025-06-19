import { Controller, Post, Body, UseGuards, Get, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard, Public } from 'src/common';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}
  
  
  @Public()
  @Post('login')
  async login(@Body() loginDto: { email: string; password: string }) {
    console.log("test")
    return this.authService.login(loginDto.email, loginDto.password);
  }
  
  @Public()
  @Post('register')
  async register(@Body() registerDto: any) {
    return this.authService.register(registerDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
  }
}